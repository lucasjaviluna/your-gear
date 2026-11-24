import { createHash } from 'node:crypto';
import { inspectWorkflow, type WorkflowRecord } from './workflow-journal.ts';

export type RecoveryLink = { parentId: string; parentDigest: string };
function digest(record: WorkflowRecord): string {
  return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}

/** A recovery is a new attempt, never a continuation of a saved authority. */
export async function prepareRecovery(input: {
  cwd: string; agentDir: string; id: string; remaining: string; files: readonly string[];
}, ask: (description: string) => Promise<string>, signal?: AbortSignal): Promise<RecoveryLink | undefined> {
  const check = () => { if (signal?.aborted) throw new Error('La ejecución fue cancelada.'); };
  check();
  if (!input.remaining.trim() || input.remaining.length > 20000) throw new Error('Indicá el trabajo pendiente explícitamente.');
  const parent = inspectWorkflow(input.cwd,input.agentDir,input.id);
  if (parent.complete) throw new Error('El workflow anterior está cerrado; iniciá una tarea nueva.');
  if (parent.effectsMayHaveOccurred && !input.files.length) throw new Error('Seleccioná al menos un archivo actualizado con --context para recuperar una tarea con posibles efectos.');
  const parentDigest = digest(parent);
  const answer = await ask([
    'Recuperación guiada: ' + parent.id,
    'Última fase registrada: ' + parent.stage,
    'Posibles efectos anteriores: ' + (parent.effectsMayHaveOccurred ? 'sí' : 'no registrados'),
    'El registro no permite saber si el proceso anterior sigue activo ni qué archivos cambió.',
    'Confirmá que la ejecución anterior y sus procesos terminaron, que inspeccionaste el workspace y que la solicitud describe solo el trabajo pendiente.',
    'Se creará un nuevo workflow con nueva clasificación, contexto, plan y todas las aprobaciones. No se reproducen llamadas ni se recuperan permisos.',
    '¿Iniciar una nueva ejecución vinculada? [s/N] ',
  ].join('\n'));
  check();
  if (answer.trim().toLowerCase() !== 's') return undefined;
  const link = { parentId: parent.id, parentDigest };
  assertRecoverySource(input.cwd,input.agentDir,link);
  return link;
}

export function assertRecoverySource(cwd: string, agentDir: string, link: RecoveryLink): void {
  const current = inspectWorkflow(cwd,agentDir,link.parentId);
  if (current.complete || digest(current) !== link.parentDigest) throw new Error('El registro anterior cambió; revisá el estado antes de recuperar.');
}

/** No original prompt, approval, plan or tool result is imported. */
export function recoveryRequest(remaining: string): string {
  const request = 'Recuperación de una tarea previa: pueden existir cambios parciales. Revisá el contexto actual, no repitas efectos ya realizados y planificá solo el trabajo pendiente indicado. Si falta información, pedí aclaración.\n\nTrabajo pendiente indicado por el usuario:\n' + remaining;
  if (request.length > 20000) throw new Error('La solicitud de recuperación es demasiado larga.');
  return request;
}
