import { assessTask, CLASSIFIER_SYSTEM_PROMPT } from './assessment.ts';
import { createToolFreeSession, runToolFreeSession } from './tool-free-agent.ts';

export function createClassifierSession(options: Parameters<typeof createToolFreeSession>[0]) {
  return createToolFreeSession(options, CLASSIFIER_SYSTEM_PROMPT);
}

export function classifyWithSession(session: Awaited<ReturnType<typeof createClassifierSession>>, prompt: string, signal: AbortSignal) {
  return runToolFreeSession(session, complete => assessTask(prompt, complete, signal), signal);
}
