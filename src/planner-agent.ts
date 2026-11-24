import { generatePlan, PLANNER_SYSTEM_PROMPT } from './plan.ts';
import type { ContextSnapshot } from './context-engine.ts';
import type { Assessment } from './assessment.ts';
import { createToolFreeSession, runToolFreeSession } from './tool-free-agent.ts';

export function createPlannerSession(options: Parameters<typeof createToolFreeSession>[0]) {
  return createToolFreeSession(options, PLANNER_SYSTEM_PROMPT);
}

export function planWithSession(session: Awaited<ReturnType<typeof createPlannerSession>>, request: string, assessment: Assessment, signal: AbortSignal, context?: ContextSnapshot) {
  return runToolFreeSession(session, complete => generatePlan(request, assessment, complete, signal, context), signal);
}
