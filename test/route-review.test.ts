import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewRoute } from '../src/route-review.ts';
import type { Assessment } from '../src/assessment.ts';

const assessment: Assessment = { recommendedRoute: 'task', source: 'llm', confidence: 'medium', reasons: ['Varios pasos'], affectedAreas: [], unknowns: [] };
test('aceptar o cambiar la ruta no concede autorización de ejecución', async () => {
  assert.deepEqual(await reviewRoute(assessment, async text => {
    assert.match(text, /no ejecuta la tarea/);
    return 's';
  }), { status: 'selected', route: 'task', source: 'accepted' });
  assert.deepEqual(await reviewRoute(assessment, async () => 'SDD'), { status: 'selected', route: 'sdd', source: 'manual' });
});
test('vacío, rechazo y respuestas desconocidas cancelan', async () => {
  for (const answer of ['', 'n', 'anything', 'execute']) assert.deepEqual(await reviewRoute(assessment, async () => answer), { status: 'cancelled' });
});
test('clarify no se puede saltar mediante una selección manual', async () => {
  const ambiguous: Assessment = { ...assessment, recommendedRoute: 'clarify', unknowns: ['¿Qué resultado?'] };
  assert.deepEqual(await reviewRoute(ambiguous, async () => 's'), { status: 'needs-clarification' });
  assert.deepEqual(await reviewRoute(ambiguous, async () => 'simple'), { status: 'cancelled' });
  assert.deepEqual(await reviewRoute(assessment, async () => 'clarify'), { status: 'needs-clarification' });
});
test('cancelación bloquea una selección tardía', async () => {
  const controller = new AbortController();
  await assert.rejects(reviewRoute(assessment, async () => { controller.abort(); return 's'; }, controller.signal), /cancelada/);
  await assert.rejects(reviewRoute(assessment, async () => { assert.fail('no debe preguntar'); }, controller.signal), /cancelada/);
});
