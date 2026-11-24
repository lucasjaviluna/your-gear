import { createHash } from 'node:crypto';
import type { Assessment } from './assessment.ts';
import type { ContextSnapshot } from './context-engine.ts';
import { isPlanApproved, type Plan, type PlanDecision } from './plan.ts';
import type { RouteDecision } from './route-review.ts';

export type ExecutionInput = {
  request: string;
  assessment: Assessment;
  decision: RouteDecision;
  context: ContextSnapshot;
  plan: Plan;
  planDecision: PlanDecision;
};
export type ExecutionReport = { summary: string; blockedCalls: number; toolErrors: number };
export type ExecutionOutcome =
  | { status: 'cancelled' | 'blocked'; reason: string }
  | { status: 'awaiting-verification'; report: ExecutionReport };

export function executionInputDigest(input: ExecutionInput): string {
  return createHash('sha256').update(JSON.stringify({
    request: input.request, assessment: input.assessment, selectedRoute: 'task', context: input.context.entries,
  })).digest('hex');
}

/** Only in-process decisions from this run are supplied by the CLI. Never import approvals. */
export async function executeApprovedTask(input: ExecutionInput, options: {
  refreshContext: () => ContextSnapshot;
  ask: (description: string) => Promise<string>;
  execute: (message: string) => Promise<ExecutionReport>;
  signal?: AbortSignal;
}): Promise<ExecutionOutcome> {
  const checkCancelled = () => {
    if (options.signal?.aborted) throw new Error('La ejecución fue cancelada.');
  };
  checkCancelled();
  const valid = () => input.assessment.recommendedRoute === 'task' &&
    input.decision.status === 'selected' && input.decision.route === 'task' &&
    isPlanApproved(input.plan, input.planDecision) && input.plan.inputDigest === executionInputDigest(input);
  if (!valid()) return { status: 'blocked', reason: 'La ruta task y el plan vigente deben estar aprobados.' };
  const approvedDigest = input.plan.digest;
  const contextDigest = input.context.digest;
  const contextHash = () => createHash('sha256').update(JSON.stringify(input.context.entries)).digest('hex');
  const fresh = () => contextHash() === contextDigest && options.refreshContext().digest === contextDigest;
  if (!fresh()) return { status: 'blocked', reason: 'El contexto cambió; generá un nuevo plan.' };
  const message = JSON.stringify({ request: input.request, plan: input.plan, context: input.context.entries });
  const answer = await options.ask('Iniciar ejecución experimental del plan ' + approvedDigest +
    '? Solo read/write/edit, con aprobación por operación. Puede modificar archivos; no hay rollback; la verificación es parcial y requiere aprobaciones adicionales. [s/N] ');
  checkCancelled();
  if (answer.trim().toLowerCase() !== 's') return { status: 'cancelled', reason: 'Ejecución no autorizada.' };
  if (!valid() || input.plan.digest !== approvedDigest || !fresh()) {
    return { status: 'blocked', reason: 'El plan o el contexto cambió; generá un nuevo plan.' };
  }
  checkCancelled();
  const report = await options.execute(message);
  checkCancelled();
  return { status: 'awaiting-verification', report };
}
