import { createToolFreeSession, runToolFreeSession } from './tool-free-agent.ts';
import { VERIFIER_SYSTEM_PROMPT } from './verification.ts';

export function createVerifierSession(options: Parameters<typeof createToolFreeSession>[0]) {
  return createToolFreeSession(options, VERIFIER_SYSTEM_PROMPT);
}

export function verifyWithSession(session: Awaited<ReturnType<typeof createVerifierSession>>, message: string, signal: AbortSignal) {
  return runToolFreeSession(session, complete => {
    if (signal.aborted) throw new Error('La ejecución fue cancelada.');
    return complete(message);
  }, signal);
}
