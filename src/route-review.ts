import type { Assessment, TaskRoute } from './assessment.ts';

export type RouteDecision =
  | { status: 'selected'; route: Exclude<TaskRoute, 'clarify'>; source: 'accepted' | 'manual' }
  | { status: 'needs-clarification' }
  | { status: 'cancelled' };

/** Review selects a strategy only. It never grants execution or tool permissions. */
export async function reviewRoute(assessment: Assessment, ask: (description: string) => Promise<string>, signal?: AbortSignal): Promise<RouteDecision> {
  if (signal?.aborted) throw new Error('La ejecución fue cancelada.');
  const description = [
    'Recomendación: ' + assessment.recommendedRoute,
    'Confianza: ' + assessment.confidence,
    'Razones: ' + JSON.stringify(assessment.reasons),
    'Áreas: ' + JSON.stringify(assessment.affectedAreas),
    'Incógnitas: ' + JSON.stringify(assessment.unknowns),
    'Seleccionar una estrategia no ejecuta la tarea ni autoriza herramientas.',
    assessment.recommendedRoute === 'clarify'
      ? 'Falta información. [s] confirmar aclaración; cualquier otra respuesta cancela: '
      : '[s] aceptar; [simple|task|sdd|clarify] elegir otra ruta; [N] cancelar: ',
  ].join('\n');
  const answer = (await ask(description)).trim().toLowerCase();
  if (signal?.aborted) throw new Error('La ejecución fue cancelada.');
  if (assessment.recommendedRoute === 'clarify') {
    return answer === 's' || answer === 'clarify' ? { status: 'needs-clarification' } : { status: 'cancelled' };
  }
  if (answer === 'clarify') return { status: 'needs-clarification' };
  if (answer === 's' || answer === assessment.recommendedRoute) {
    return { status: 'selected', route: assessment.recommendedRoute, source: 'accepted' };
  }
  if (answer === 'simple' || answer === 'task' || answer === 'sdd') {
    return { status: 'selected', route: answer, source: 'manual' };
  }
  return { status: 'cancelled' };
}
