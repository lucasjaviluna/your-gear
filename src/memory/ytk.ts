import { McpClient, StdioTransport } from '@earendil-works/pi-mcp';
import type { MemoryConfig } from './config.ts';
import type { MemoryDraft, MemoryEntry, MemoryProvider, MemorySession } from './provider.ts';

const names = ['memory_list','memory_search','memory_get','memory_session_start','memory_save','memory_session_finish'] as const;
type Tool = typeof names[number];
type Call = (name: Tool, args: Record<string, unknown>) => Promise<unknown>;
const limits = { limit: 8, maxChars: 2400 };
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Respuesta de memoria inválida.');
  return v as Record<string, unknown>;
}
function string(v: unknown, max: number, empty = false): string {
  if (typeof v !== 'string' || v.length > max || (!empty && !v.trim())) throw new Error('Campo de memoria inválido.');
  return v;
}
function entry(v: unknown, project: string, area?: string): MemoryEntry {
  const e = record(v);
  if (e.projectId !== project || (area && e.area !== area) || e.status !== 'active') throw new Error('Memoria fuera del alcance o no activa.');
  for (const field of ['reviewAt','expiresAt']) {
    if (e[field] !== undefined && e[field] !== null &&
        (typeof e[field] !== 'string' || !Number.isFinite(Date.parse(e[field] as string)) || Date.parse(e[field] as string) <= Date.now())) throw new Error('Memoria no vigente.');
  }
  return { id: string(e.id,200), title: string(e.title,1000,true), content: string(e.content,48002,true),
    type: string(e.type,20), ...(e.subjectKey == null ? {} : { subjectKey: string(e.subjectKey,500) }) };
}
function entries(v: unknown, project: string, area?: string): MemoryEntry[] {
  const list = record(v).entries;
  if (!Array.isArray(list) || list.length > limits.limit) throw new Error('Lista de memoria inválida.');
  let budget = 4800; // UTF-16 code units; YTK search maxChars is per entry.
  return list.map(e => entry(e,project,area)).flatMap(e => {
    if (budget <= 0) return [];
    const title = e.title.slice(0,budget);
    budget -= title.length;
    const content = e.content.slice(0,budget);
    budget -= content.length;
    return [{...e,title,content}];
  });
}

/** Translate only the agreed six operations; callers cannot invoke arbitrary MCP tools. */
export function createYtkProvider(config: Pick<MemoryConfig,'project'|'area'>, call: Call,
  check: () => Promise<void>, close: () => Promise<void>, allowWrites = false): MemoryProvider {
  let active: string | undefined;
  let closed = false;
  const invoke = (name: Tool, args: Record<string, unknown>) => {
    if (closed) throw new Error('Proveedor de memoria cerrado.');
    return call(name,args);
  };
  const write = () => { if (!allowWrites) throw new Error('Escritura de memoria no habilitada.'); };
  const session = (id: string) => { if (!active || id !== active) throw new Error('Sesión de memoria no pertenece a esta conexión.'); };
  return {
    check,
    async list() { return entries(await invoke('memory_list',limits),config.project,config.area); },
    async search(query) { return entries(await invoke('memory_search',{...limits,query:string(query,2000)}),config.project,config.area); },
    async get(id) {
      const result = entry(record(await invoke('memory_get',{memoryId:string(id,200),maxChars:20000})).entry,config.project,config.area);
      if (result.id !== id) throw new Error('ID de memoria no coincide.');
      return result;
    },
    async start(): Promise<MemorySession> {
      write();
      if (active) throw new Error('Ya existe una sesión de memoria.');
      const result = record(await invoke('memory_session_start',limits));
      active = string(result.sessionId,200);
      return { id:active, entries:entries(result,config.project,config.area) };
    },
    async save(id,draft: MemoryDraft) {
      write(); session(id);
      if (!['decision','discovery','pattern','preference','summary'].includes(draft.type)) throw new Error('Tipo de memoria inválido.');
      const response = record(await invoke('memory_save',{sessionId:id,type:draft.type,title:string(draft.title,500),
        content:string(draft.content,20000),subjectKey:string(draft.subjectKey,500),source:'your-gear'}));
      if (response.stored !== true) throw new Error('Guardado de memoria no confirmado.');
      return string(response.entryId,200);
    },
    async finish(id,summary) {
      write(); session(id);
      const response = record(await invoke('memory_session_finish',{sessionId:id,...(summary ? {summary:string(summary,20000)} : {})}));
      if (response.sessionId !== id || response.summaryStored !== Boolean(summary)) throw new Error('Cierre de memoria no confirmado.');
      active = undefined;
    },
    async close() { if (!closed) { closed = true; await close(); } },
  };
}

export function ytkArgs(config: MemoryConfig): string[] {
  return ['mcp','--project',config.project,'--database',config.database,...(config.area ? ['--area',config.area] : [])];
}

async function bounded<T>(action: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new Error('Conexión de memoria cancelada o agotada.');
  let listener = () => {};
  try {
    return await Promise.race([action,new Promise<never>((_,reject) => {
      listener = () => reject(new Error('Conexión de memoria cancelada o agotada.'));
      signal.addEventListener('abort',listener,{once:true});
    })]);
  } finally { signal.removeEventListener('abort',listener); }
}

/** This process belongs to the harness, not to an LLM tool registry. */
export async function connectYtk(config: MemoryConfig, signal?: AbortSignal, allowWrites = false): Promise<MemoryProvider> {
  const deadline = () => AbortSignal.any([AbortSignal.timeout(10000),...(signal ? [signal] : [])]);
  if (signal?.aborted) throw new Error('Conexión de memoria cancelada.');
  const client = new McpClient({name:'your-gear',version:'0.0.0'});
  const transport = new StdioTransport({command:config.command,args:ytkArgs(config),cwd:config.cwd});
  const check = async () => {
    const tools = await bounded(client.listTools(),deadline());
    if (!names.every(name=>tools.some(tool=>tool.name===name))) throw new Error('Servidor de memoria incompatible.');
  };
  try {
    await bounded(client.connect(transport),deadline());
    await check();
    return createYtkProvider(config,async (name,args) => {
      const callSignal = deadline();
      const result = await bounded(client.callTool(name,args,{signal:callSignal}),callSignal);
      if (result.isError) throw new Error('Operación de memoria rechazada.');
      if (result.structuredContent === undefined || Buffer.byteLength(JSON.stringify(result.structuredContent)) > 256*1024) throw new Error('Respuesta de memoria inválida o demasiado grande.');
      return result.structuredContent;
    },check,()=>client.close(),allowWrites);
  } catch {
    await client.close().catch(()=>{});
    throw new Error('No se pudo conectar con el proveedor de memoria.');
  }
}
