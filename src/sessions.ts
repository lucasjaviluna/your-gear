import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SessionManager } from '@earendil-works/pi-coding-agent';

export type SessionMode = 'memory' | 'persist' | 'continue';

export function parseSessionArgs(args: readonly string[]): { mode: SessionMode; promptArgs: string[]; skillPath?: string } {
  let mode: SessionMode = 'memory';
  let skillPath: string | undefined;
  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (arg === '--') return { mode, promptArgs: args.slice(index + 1), ...(skillPath ? { skillPath } : {}) };
    if (arg === '--help' || arg === '-h') return { mode, promptArgs: args.slice(index), ...(skillPath ? { skillPath } : {}) };
    if (!arg.startsWith('-') || arg === '-') break;
    if (arg === '--skill') {
      if (skillPath || !args[index + 1] || args[index + 1].startsWith('-')) throw new Error('Indicá una sola ruta de skill después de --skill.');
      skillPath = args[index + 1];
      index += 2;
      continue;
    }
    if (arg !== '--persist' && arg !== '--continue') {
      throw new Error(`Opción desconocida: ${arg}. Usá --persist, --continue o --skill.`);
    }
    if (mode !== 'memory') throw new Error('Elegí solo una opción de sesión.');
    mode = arg === '--persist' ? 'persist' : 'continue';
    index++;
  }
  return { mode, promptArgs: args.slice(index), ...(skillPath ? { skillPath } : {}) };
}

export async function createSessionManager(cwd: string, agentDir: string, mode: SessionMode): Promise<SessionManager> {
  if (mode === 'memory') return SessionManager.inMemory(cwd);
  const workspace = realpathSync(cwd);
  const key = createHash('sha256').update(workspace).digest('hex');
  const sessionDir = join(agentDir, 'sessions', key);
  if (mode === 'continue') {
    let files: string[];
    try {
      files = readdirSync(sessionDir).filter(file => file.endsWith('.jsonl'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        try {
          if (!statSync(join(agentDir, 'sessions')).isDirectory()) throw new Error('invalid directory');
        } catch (parentError) {
          if ((parentError as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw new Error('No se pudo acceder al directorio de sesiones. Revisá sus permisos.');
          }
        }
        throw new Error('No hay una sesión guardada para este workspace. Iniciá una con --persist.');
      }
      throw new Error('No se pudo acceder al directorio de sesiones. Revisá sus permisos.');
    }
    if (!files.length) throw new Error('No hay una sesión guardada para este workspace. Iniciá una con --persist.');
    try {
      const latest = files.map(file => {
        const path = join(sessionDir, file);
        return { path, mtime: statSync(path).mtimeMs };
      }).sort((a, b) => b.mtime - a.mtime)[0].path;
      const contents = readFileSync(latest, 'utf8');
      const lines = contents.split('\n').filter(line => line.trim());
      if (!lines.length) throw new Error('invalid');
      const entries: unknown[] = lines.map(line => JSON.parse(line));
      if (entries.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry) || typeof (entry as { type?: unknown }).type !== 'string')) throw new Error('invalid');
      const header = entries[0] as { type?: unknown; id?: unknown; cwd?: unknown };
      if (header.type !== 'session' || typeof header.id !== 'string' || typeof header.cwd !== 'string' || realpathSync(header.cwd) !== workspace) throw new Error('invalid');
      return SessionManager.open(latest, sessionDir);
    } catch (error) {
      if (['EACCES', 'EPERM', 'EBUSY', 'EIO'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        throw new Error('No se pudo leer la sesión más reciente. Revisá sus permisos y disponibilidad.');
      }
      throw new Error('La sesión más reciente está dañada o no corresponde a este workspace. Se conservó el archivo sin cambios.');
    }
  }
  mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
  return SessionManager.create(workspace, sessionDir);
}
