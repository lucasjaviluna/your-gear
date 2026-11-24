import { authorizeTool, type Approval } from './policy.ts';

/** Kept free of Pi imports so authorization can be tested without network/model. */
export function createToolCallHandler(cwd: string, approve: Approval, allowedMcp: readonly string[] = []) {
  return (event: { toolName: string; input: unknown }) => authorizeTool(
    { cwd, toolName: event.toolName, input: event.input }, approve, allowedMcp,
  );
}
