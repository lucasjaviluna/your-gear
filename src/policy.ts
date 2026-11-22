import { lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export type Decision = { type: 'allow' | 'ask' | 'deny'; reason: string };
export type ToolCall = { toolName: string; input: unknown; cwd: string };
export type Approval = (description: string) => Promise<boolean>;

// Initial conservative list. This is NOT a sandbox or a complete DLP system.
const PROTECTED = new Set([
  '.git', '.ssh', '.pi', '.your-gear', '.aws', '.config',
  '.env', '.npmrc', '.netrc', '.pypirc', 'auth.json', 'credentials',
]);

function isProtected(path: string, cwd: string): boolean {
  return relative(cwd, path).split(sep).some(
    part => PROTECTED.has(part.toLowerCase()) || part.toLowerCase().startsWith('.env.'),
  );
}

function safeWorkspacePath(cwd: string, requested: string): string | undefined {
  try {
    const root = realpathSync(cwd);
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
    const candidate = resolve(realpathSync(existing), relative(existing, absolute));
    const rel = relative(root, candidate);
    if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) return undefined;
    if (isProtected(candidate, root)) return undefined;
    return candidate;
  } catch {
    return undefined;
  }
}

export function decideTool({ toolName, input, cwd }: ToolCall): Decision {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { type: 'deny', reason: 'Argumentos inválidos' };
  }
  const args = input as Record<string, unknown>;
  if (['read', 'write', 'edit'].includes(toolName)) {
    if (typeof args.path !== 'string' || !args.path.trim()) {
      return { type: 'deny', reason: 'Ruta inválida' };
    }
    const path = safeWorkspacePath(cwd, args.path);
    if (!path) return { type: 'deny', reason: 'Ruta protegida, inaccesible o fuera del workspace' };
    if (toolName === 'read') return { type: 'allow', reason: 'Lectura dentro del workspace' };
    return { type: 'ask', reason: `${toolName}: ${JSON.stringify(path)}` };
  }
  if (toolName === 'bash') {
    if (typeof args.command !== 'string' || !args.command.trim()) {
      return { type: 'deny', reason: 'Comando inválido' };
    }
    return { type: 'ask', reason: `bash (cwd=${JSON.stringify(cwd)}): ${JSON.stringify(args.command)}` };
  }
  return { type: 'deny', reason: `Herramienta no autorizada: ${toolName}` };
}

export async function authorizeTool(call: ToolCall, approve: Approval): Promise<{ block: true; reason: string } | undefined> {
  const decision = decideTool(call);
  if (decision.type === 'allow') return undefined;
  if (decision.type === 'deny') return { block: true, reason: decision.reason };
  try {
    return (await approve(decision.reason))
      ? undefined
      : { block: true, reason: 'El usuario rechazó la operación' };
  } catch {
    return { block: true, reason: 'No fue posible solicitar aprobación' };
  }
}
