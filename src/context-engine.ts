import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { extname, isAbsolute, join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { decideTool } from './policy.ts';

const MAX_FILES = 8;
const MAX_FILE_BYTES = 8000;
const MAX_CONTEXT_BYTES = 24000;
const DEFAULT_FILES = ['AGENTS.md', 'README.md', 'package.json', 'tsconfig.json', 'pyproject.toml', 'go.mod', 'Cargo.toml'];
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss', '.html', '.cs', '.csproj', '.sln', '.py', '.go', '.rs', '.java', '.kt', '.toml', '.yaml', '.yml', '.sql', '.mod']);
const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage', 'vendor', 'bin', 'obj', 'secrets', 'credentials']);

export type ContextEntry = { path: string; content: string };
export type ContextSnapshot = { entries: ContextEntry[]; bytes: number; digest: string };

function allowedName(path: string): boolean {
  return TEXT_EXTENSIONS.has(extname(path).toLowerCase()) &&
    path.split(/[\\/]/).every(part => part.length > 0 && !part.startsWith('.') &&
      !SKIP.has(part.toLowerCase()) && !/(?:secret|credential|private[-_]?key|password|token|auth\.json)/i.test(part));
}

/** Only local regular files, no symlink components, no hardlinks, bounded read. */
function readEntry(root: string, requested: string): ContextEntry {
  const parts = requested.split(/[\\/]/);
  if (requested.length > 512 || isAbsolute(requested) || /[:\x00-\x1f\x7f]/.test(requested) || !allowedName(requested)) {
    throw new Error('Ruta de contexto no permitida.');
  }
  const path = join(root, ...parts);
  if (decideTool({ cwd: root, toolName: 'read', input: { path } }).type !== 'allow') throw new Error('Ruta de contexto no permitida.');
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error('No se admiten enlaces en el contexto.');
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > MAX_FILE_BYTES) throw new Error('Archivo de contexto no regular o demasiado grande.');
  const canonical = realpathSync(path);
  const rel = relative(root, canonical);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep) || !allowedName(rel)) throw new Error('Ruta de contexto no permitida.');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size > MAX_FILE_BYTES) throw new Error('El archivo cambió o no es regular.');
    const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
    let total = 0;
    while (total < buffer.length) {
      const count = readSync(fd, buffer, total, buffer.length - total, null);
      if (!count) break;
      total += count;
    }
    if (total > MAX_FILE_BYTES || buffer.subarray(0, total).includes(0)) throw new Error('Archivo de contexto no textual o demasiado grande.');
    const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, total));
    return { path: rel.split(sep).join('/'), content };
  } finally { closeSync(fd); }
}

function snapshot(entries: ContextEntry[]): ContextSnapshot {
  const encoded = JSON.stringify(entries);
  return { entries, bytes: Buffer.byteLength(encoded), digest: createHash('sha256').update(encoded).digest('hex') };
}

/** Explicit selections take priority; optional root metadata only, no recursive discovery. */
export function collectContext(cwd: string, selected: readonly string[] = [], signal?: AbortSignal): ContextSnapshot {
  if (selected.length > MAX_FILES) throw new Error('Se admiten hasta 8 archivos de contexto.');
  const root = realpathSync(cwd);
  const entries: ContextEntry[] = [];
  const seen = new Set<string>();
  const paths = [...selected.map(path => ({ path, required: true })), ...DEFAULT_FILES.map(path => ({ path, required: false }))];
  for (const { path, required } of paths) {
    if (signal?.aborted) throw new Error('La ejecución fue cancelada.');
    if (entries.length >= MAX_FILES) break;
    try {
      const entry = readEntry(root, path);
      const key = process.platform === 'win32' ? entry.path.toLowerCase() : entry.path;
      if (seen.has(key)) continue;
      if (snapshot([...entries, entry]).bytes > MAX_CONTEXT_BYTES) throw new Error('Presupuesto de contexto excedido.');
      entries.push(entry);
      seen.add(key);
    } catch {
      if (required) throw new Error('No se pudo incluir un archivo de contexto explícito: ' + JSON.stringify(path));
      // Optional default file may be missing, blocked, oversized or exceed the budget.
    }
  }
  return snapshot(entries);
}

/** Preview the exact payload before sending it to the model; escape terminal controls. */
export async function approveContext(context: ContextSnapshot, ask: (description: string) => Promise<string>, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) throw new Error('La ejecución fue cancelada.');
  const original = snapshot(context.entries);
  if (original.digest !== context.digest || original.bytes !== context.bytes) throw new Error('El contexto cambió.');
  if (!context.entries.length) return true;
  const preview = JSON.stringify(context.entries, null, 2).replace(/[\u007f-\u009f\u2028-\u202e\u2066-\u2069]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  const answer = await ask('Contexto local que se enviará al planificador (revisar posibles datos sensibles):\n' + preview + '\n¿Enviar exactamente este contexto al proveedor configurado? [s/N] ');
  if (signal?.aborted) throw new Error('La ejecución fue cancelada.');
  if (snapshot(context.entries).digest !== original.digest || context.digest !== original.digest || context.bytes !== original.bytes) throw new Error('El contexto cambió durante la aprobación.');
  return answer.trim().toLowerCase() === 's';
}

export function parsePlanningArgs(args: readonly string[]): { files: string[]; promptArgs: string[] } {
  const files: string[] = [];
  let index = 0;
  while (args[index] === '--context') {
    const path = args[index + 1];
    if (!path || path.startsWith('-') || files.length >= MAX_FILES) throw new Error('Indicá hasta 8 rutas después de --context.');
    files.push(path);
    index += 2;
  }
  return { files, promptArgs: args.slice(index) };
}
