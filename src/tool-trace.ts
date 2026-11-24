/** Minimal terminal trace; never print tool arguments or results. */
import type { SessionMode } from './sessions.ts';
import type { Approval } from './policy.ts';

export function traceApproval(approve: Approval, write: (text: string) => void): Approval {
  return async operation => {
    try {
      const allowed = await approve(operation);
      write(`Your Gear: aprobación ${allowed ? 'concedida' : 'no concedida'}\n`);
      return allowed;
    } catch (error) {
      write('Your Gear: no se pudo solicitar aprobación\n');
      throw error;
    }
  };
}

export function traceSession(mode: SessionMode, write: (text: string) => void): void {
  const status = { memory: 'en memoria', persist: 'nueva persistente', continue: 'reanudada' };
  write(`Your Gear: sesión ${status[mode]}\n`);
}

export function createToolTrace(write: (text: string) => void, allowedMcp: readonly string[] = []) {
  const tools = new Set(['read', 'write', 'edit', 'bash', ...allowedMcp]);
  return (event: { type: string; toolName?: string; isError?: boolean }) => {
    if (!event.toolName || !tools.has(event.toolName)) return;
    if (event.type === 'tool_execution_start') {
      write(`Your Gear: herramienta ${event.toolName} solicitada\n`);
    } else if (event.type === 'tool_execution_end') {
      write(`Your Gear: herramienta ${event.toolName} ${event.isError ? 'finalizó con error' : 'finalizó'}\n`);
    }
  };
}
