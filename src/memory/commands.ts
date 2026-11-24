import type { MemoryProvider } from './provider.ts';
import { readMemoryConfig, type MemoryConfig } from './config.ts';
import { safePreview } from '../verification-evidence.ts';

type MemoryCommand = { kind: 'status'|'list' } | { kind:'search'|'get'; value:string };
export function parseMemoryCommand(args: readonly string[]): MemoryCommand {
  if (args.length === 1 && (args[0] === 'status' || args[0] === 'list')) return {kind:args[0]};
  if (args[0] === 'search' && args.length > 1 && args.slice(1).join(' ').trim()) return {kind:'search',value:args.slice(1).join(' ')};
  if (args[0] === 'get' && args.length === 2 && args[1].trim()) return {kind:'get',value:args[1]};
  throw new Error('Uso: your-gear memory status|list|search CONSULTA|get ID');
}

export async function runMemoryCommand(command: MemoryCommand, options: {
  cwd: string; agentDir: string; interactive: boolean;
  approve: (description:string) => Promise<boolean>;
  connect: (config:MemoryConfig) => Promise<MemoryProvider>;
  signal?: AbortSignal;
}): Promise<unknown> {
  const check = () => { if (options.signal?.aborted) throw new Error('La ejecución fue cancelada.'); };
  check();
  const config = readMemoryConfig(options.cwd,options.agentDir);
  if (!config) {
    if (command.kind === 'status') return {status:'disabled'};
    throw new Error('Memoria no configurada para este workspace.');
  }
  if (!options.interactive) throw new Error('Memoria requiere terminal interactiva para autorizar el inicio.');
  const accepted = await options.approve('Iniciar proveedor local YTK (sin modelo):\n' + safePreview(config) +
    '\nEl binario puede migrar la base y no está aislado. Este comando no solicita guardados de memoria.');
  check();
  if (!accepted) throw new Error('Inicio de memoria no autorizado.');
  const provider = await options.connect(config);
  try {
    check();
    if (command.kind === 'status') return {status:'available',provider:'ytk',project:config.project};
    if (command.kind === 'list') return {entries:await provider.list()};
    if (command.kind === 'search') return {entries:await provider.search(command.value)};
    if (command.kind === 'get') return {entry:await provider.get(command.value)};
    throw new Error('Comando de memoria inválido.');
  } finally { await provider.close(); }
}
