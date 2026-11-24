import { createHash, randomUUID } from 'node:crypto';
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MAX_BYTES = 256 * 1024;
const MAX_EVENTS = 1000;
export type Phase = 'created' | 'classifying' | 'route-review' | 'context-review' | 'planning' | 'plan-review' | 'execution-review' | 'executing' | 'verifying';
export type Terminal = 'accepted' | 'needs-review' | 'inconclusive' | 'cancelled' | 'blocked' | 'failed';
export type Stage = Phase | Terminal;
const next: Record<Phase, readonly Stage[]> = {
  created: ['classifying'], classifying: ['route-review'], 'route-review': ['context-review'],
  'context-review': ['planning'], planning: ['plan-review'], 'plan-review': ['execution-review'],
  'execution-review': ['executing'], executing: ['verifying'], verifying: ['accepted', 'needs-review', 'inconclusive'],
};
const terminals = new Set<string>(['accepted','needs-review','inconclusive','cancelled','blocked','failed']);
const earlyTerminals = new Set<string>(['cancelled','blocked','failed']);
type Metadata =
  | { kind: 'route'; recommended: 'simple'|'task'|'sdd'|'clarify'; decision: 'simple'|'task'|'sdd'|'needs-clarification'|'cancelled' }
  | { kind: 'context'; digest: string; files: number; approved: boolean }
  | { kind: 'plan'; digest: string; version: number; criteria: number; decision: 'approved'|'needs-clarification'|'cancelled' }
  | { kind: 'tool-approval'; approved: boolean }
  | { kind: 'execution'; blockedCalls: number; toolErrors: number }
  | { kind: 'test'; status: 'exit-zero'|'failed'|'error'|'skipped'|'stale'; exitCode: number|null; outputTruncated: boolean }
  | { kind: 'verification'; status: 'accepted'|'needs-review'|'cancelled'|'inconclusive'; supported: number; total: number };
type Event = { seq: number; at: string; stage: Stage } | { seq: number; at: string; metadata: Metadata };
type Header = { schema: 1; id: string; workspace: string };
export type WorkflowRecord = { id: string; stage: Stage; complete: boolean; events: Event[] };

function validTransition(from: Stage, to: Stage): boolean {
  if (terminals.has(from)) return false;
  return earlyTerminals.has(to) || next[from as Phase].includes(to);
}
function count(value: unknown): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function metadataValid(value: unknown, stage: Stage): value is Metadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  const keys = (list: string[]) => Object.keys(m).length === list.length && list.every(k => Object.hasOwn(m,k));
  const one = (v: unknown, values: string[]) => typeof v === 'string' && values.includes(v);
  const digest = (v: unknown) => typeof v === 'string' && DIGEST.test(v);
  switch (m.kind) {
    case 'route': return stage === 'route-review' && keys(['kind','recommended','decision']) && one(m.recommended,['simple','task','sdd','clarify']) && one(m.decision,['simple','task','sdd','needs-clarification','cancelled']);
    case 'context': return stage === 'context-review' && keys(['kind','digest','files','approved']) && digest(m.digest) && count(m.files) && typeof m.approved === 'boolean';
    case 'plan': return stage === 'plan-review' && keys(['kind','digest','version','criteria','decision']) && digest(m.digest) && count(m.version) && count(m.criteria) && one(m.decision,['approved','needs-clarification','cancelled']);
    case 'tool-approval': return stage === 'executing' && keys(['kind','approved']) && typeof m.approved === 'boolean';
    case 'execution': return stage === 'executing' && keys(['kind','blockedCalls','toolErrors']) && count(m.blockedCalls) && count(m.toolErrors);
    case 'test': return stage === 'verifying' && keys(['kind','status','exitCode','outputTruncated']) && one(m.status,['exit-zero','failed','error','skipped','stale']) && (m.exitCode === null || count(m.exitCode)) && typeof m.outputTruncated === 'boolean';
    case 'verification': return stage === 'verifying' && keys(['kind','status','supported','total']) && one(m.status,['accepted','needs-review','cancelled','inconclusive']) && count(m.supported) && count(m.total) && Number(m.supported) <= Number(m.total);
    default: return false;
  }
}
function workspaceKey(cwd: string): string {
  return createHash('sha256').update(realpathSync(cwd)).digest('hex');
}
function directory(cwd: string, agentDir: string, create = false): string {
  let path = agentDir;
  for (const part of ['', 'workflows', workspaceKey(cwd)]) {
    if (part) path = join(path, part);
    if (create) mkdirSync(path, { recursive: true, mode: 0o700 });
    const info = lstatSync(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Directorio de workflows no permitido.');
  }
  return path;
}
function readRecord(path: string, id: string, workspace: string): WorkflowRecord {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > MAX_BYTES) throw new Error('Registro no permitido.');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  let raw: string;
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.nlink !== 1 || opened.ino !== stat.ino || opened.dev !== stat.dev || opened.size > MAX_BYTES) throw new Error('Registro no permitido.');
    raw = readFileSync(fd, 'utf8');
    if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error('Registro demasiado grande.');
  } finally { closeSync(fd); }
  if (!raw.endsWith('\n')) throw new Error('Registro incompleto o dañado; no se reutilizará.');
  const [header, ...events] = raw.trimEnd().split('\n').map(line => JSON.parse(line));
  if (!header || header.schema !== 1 || header.id !== id || header.workspace !== workspace ||
      Object.keys(header).length !== 3 || !events.length || events.length > MAX_EVENTS) throw new Error('Registro inválido.');
  let stage: Stage = 'created';
  for (const [i, e] of events.entries()) {
    if (!e || e.seq !== i || typeof e.at !== 'string' || !Number.isFinite(Date.parse(e.at)) || Object.keys(e).length !== 3) throw new Error('Evento inválido.');
    if (i === 0) { if (e.stage !== 'created') throw new Error('Inicio inválido.'); continue; }
    if (Object.hasOwn(e,'stage')) {
      if (!validTransition(stage, e.stage)) throw new Error('Transición inválida.');
      stage = e.stage;
    } else if (!metadataValid(e.metadata, stage)) throw new Error('Metadatos inválidos.');
  }
  return { id, stage, complete: terminals.has(stage), events };
}

export function inspectWorkflow(cwd: string, agentDir: string, id: string): WorkflowRecord {
  if (!ID.test(id)) throw new Error('ID de workflow inválido.');
  return readRecord(join(directory(cwd,agentDir), id + '.jsonl'), id, workspaceKey(cwd));
}

export function listWorkflows(cwd: string, agentDir: string) {
  let dir: string;
  try { dir = directory(cwd, agentDir); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  return readdirSync(dir).filter(name => name.endsWith('.jsonl') && ID.test(name.slice(0,-6)))
    .map(name => ({ id: name.slice(0,-6), mtime: lstatSync(join(dir,name)).mtimeMs }))
    .sort((a,b) => b.mtime-a.mtime).slice(0,50).map(({id}) => {
      try { const record = inspectWorkflow(cwd,agentDir,id); return { id, stage: record.stage, complete: record.complete }; }
      catch { return { id, stage: 'unreadable', complete: false }; }
    });
}

/** One writer per new UUID. A failed write stops further transitions, never permits replay. */
export function createWorkflowJournal(cwd: string, agentDir: string) {
  const id = randomUUID();
  const path = join(directory(cwd, agentDir, true), id + '.jsonl');
  const header: Header = { schema: 1, id, workspace: workspaceKey(cwd) };
  const fd = openSync(path, 'wx', 0o600);
  let stage: Stage = 'created';
  let seq = 0, bytes = 0, closed = false, broken = false;
  const append = (data: unknown) => {
    if (closed || broken) throw new Error('Registro de workflow no disponible.');
    const line = JSON.stringify(data) + '\n';
    if (bytes + Buffer.byteLength(line) > MAX_BYTES) { broken = true; throw new Error('Límite de registro alcanzado.'); }
    try {
      writeFileSync(fd, line, 'utf8');
      fsyncSync(fd);
      bytes += Buffer.byteLength(line);
    } catch (error) { broken = true; throw error; }
  };
  const event = (payload: { stage: Stage } | { metadata: Metadata }) => {
    if (seq >= MAX_EVENTS) { broken = true; throw new Error('Límite de eventos alcanzado.'); }
    append({ seq, at: new Date().toISOString(), ...payload });
    seq++;
  };
  try { append(header); event({stage}); } catch (error) { closeSync(fd); throw error; }
  return {
    id,
    transition(to: Stage) {
      if (!validTransition(stage,to)) throw new Error('Transición de workflow inválida.');
      event({ stage: to }); stage = to;
    },
    record(metadata: Metadata) {
      if (!metadataValid(metadata,stage)) throw new Error('Metadatos de workflow inválidos.');
      event({ metadata });
    },
    finish(to: Terminal) { if (!terminals.has(stage)) { if (!validTransition(stage,to)) throw new Error('Cierre inválido.'); event({stage:to}); stage=to; } },
    close() { if (!closed) { closed = true; closeSync(fd); } },
  };
}
export type WorkflowJournal = ReturnType<typeof createWorkflowJournal>;
