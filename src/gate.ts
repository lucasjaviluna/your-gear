import { authorizeTool, type Approval } from './policy.ts';

/** Kept free of Pi imports so authorization can be tested without network/model. */
export function createToolCallHandler(cwd: string, approve: Approval, allowedMcp: readonly string[] = [], signal?: AbortSignal) {
  return async (event: { toolName: string; input: unknown }) => {
    const cancelled = { block: true as const, reason: 'La ejecución fue cancelada.' };
    if (signal?.aborted) return cancelled;
    const result = await authorizeTool({ cwd, toolName: event.toolName, input: event.input }, approve, allowedMcp);
    return signal?.aborted ? cancelled : result;
  };
}
