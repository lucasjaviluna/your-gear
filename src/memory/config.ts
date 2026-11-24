import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export type MemoryConfig = { command: string; project: string; database: string; area?: string; cwd: string };
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const safe = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);

/** Only user-owned configuration can authorize a binary and an exact workspace scope. */
export function readMemoryConfig(cwd: string, agentDir: string): MemoryConfig | undefined {
  let raw: string;
  try { raw = readFileSync(join(agentDir,'memory.json'),'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw new Error('No se pudo leer memory.json.'); }
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('memory.json inválido.'); }
  if (!object(value) || Object.keys(value).length !== 1 || !object(value.workspaces)) throw new Error('memory.json inválido.');
  const root = realpathSync(cwd);
  if (!Object.hasOwn(value.workspaces,root)) return undefined;
  const entry = value.workspaces[root];
  if (!object(entry) || Object.keys(entry).some(k => !['provider','command','project','database','area'].includes(k)) ||
      entry.provider !== 'ytk' || !safe(entry.command,4096) || !isAbsolute(entry.command) ||
      !safe(entry.project,200) || !safe(entry.database,4096) || !isAbsolute(entry.database) ||
      (entry.area !== undefined && !safe(entry.area,100))) throw new Error('Configuración de memoria inválida.');
  // Never create a database accidentally through an incorrect path.
  if (!statSync(entry.command).isFile() || !statSync(entry.database).isFile()) throw new Error('Ejecutable o base de memoria no disponibles.');
  return { command: realpathSync(entry.command), project: entry.project, database: realpathSync(entry.database), ...(entry.area ? {area: entry.area as string} : {}), cwd: root };
}
