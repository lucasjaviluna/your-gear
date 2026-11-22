import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep, dirname, basename } from 'node:path';

type Decision = { type: 'allow' | 'ask' | 'deny'; reason: string };
export type ToolCall = { toolName: string; input: unknown; cwd: string };
export type Approval = (description: string) => Promise<boolean>;

const PROTECTED = new Set(['.git', '.ssh', '.pi', '.env', '.your-gear', 'auth.json']);

function isProtected(path: string, cwd: string): boolean {
  const parts = relative(cwd, path).split(sep);
  return parts.some(part => PROTECTED.has(part) || part.startsWith('.env.'));
}

function safelyResolve(cwd: string, requested: string): string | undefined {
  try {
    const realCwd = realpathSync(cwd);
    const absolute = resolve(cwd, requested);
    let existing = absolute;
    while (true) {
      try {
        lstatSync(existing);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return undefined;
        const parent = dirname(existing);
        if (parent === existing) return undefined;
        existing = parent;
      }
    }
    const realExisting = realpathSync(existing);
    const candidate = resolve(realExisting, relative(existing, absolute));
    const rel = relative(realCwd, candidate);
    if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) return undefined;
    if (isProtected(candidate, realCwd)) return undefined;
    return candidate;
  } catch {
    return undefined; // fail closed: inaccessible path, broken symlink, etc.
  }
}

export function decideTool(call: ToolCall): Decision {
  const { toolName, input, cwd } = call;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { type: 'deny', reason: 'Argumentos de herramienta inválidos' };
  }
  const args = input as Record<string, unknown>;
  if (toolName === 'read' || toolName === 'write' || toolName === 'edit') {
    if (typeof args.path !== 'string' || !args.path.trim()) {
      return { type: 'deny', reason: 'Ruta inválida' };
    }
    const canonical = safelyResolve(cwd, args.path);
    if (!canonical) return { type: 'deny', reason: 'Ruta fuera del workspace, protegida o inaccesible' };
    return toolName === 'read'
      ? { type: 'allow', reason: 'Lectura dentro del workspace' }
      : { type: 'ask', reason: `${toolName} sobre ${canonical}` };
  }
  if (toolName === 'bash') {
    if (typeof args.command !== 'string' || !args.command.trim()) {
      return { type: 'deny', reason: 'Comando inválido' };
    }
    return { type: 'ask', reason: `Shell en ${cwd}: ${args.command}` };
  }
  return { type: 'deny', reason: `Herramienta no habilitada: ${toolName}` };
}

/** Returned value matches Pi's pre-execution tool_call block contract. */
export async function authorizeTool(call: ToolCall, approve: Approval): Promise<{ block: true; reason: string } | undefined> {
  const decision = decideTool(call);
  if (decision.type === 'allow') return undefined;
  if (decision.type === 'deny') return { block: true, reason: decision.reason };
  try {
    return (await approve(decision.reason)) ? undefined : { block: true, reason: 'Operación no aprobada' };
  } catch {
    return { block: true, reason: 'No fue posible obtener autorización' };
  }
}
