import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePlan, isPlanApproved, parsePlan, reviewPlan, versionPlan, type PlanDraft } from '../src/plan.ts';
import type { Assessment } from '../src/assessment.ts';

const assessment: Assessment = { recommendedRoute: 'task', source: 'llm', confidence: 'medium', reasons: ['Varios pasos'], affectedAreas: [], unknowns: [] };
const draft: PlanDraft = { objective: 'Agregar reintentos', scope: 'Una llamada HTTP', steps: ['Inspeccionar cliente', 'Implementar reintentos'], acceptanceCriteria: ['Los fallos transitorios se reintentan'], risks: ['Repetición de efectos'], assumptions: [], unknowns: [] };

test('normaliza únicamente listas válidas de alcance y conserva validación estricta', async () => {
  const plan = await generatePlan('tarea', assessment, async () => JSON.stringify({ ...draft, scope: [' archivo A ', 'archivo B'] }));
  assert.equal(plan.scope, 'archivo A\narchivo B');
  for (const scope of [[], [42], [''], Array(13).fill('x'), ['x'.repeat(1001)], ['x'.repeat(1000), 'y'.repeat(1000)]]) {
    await assert.rejects(generatePlan('tarea', assessment, async () => JSON.stringify({ ...draft, scope })), /plan inválido/);
  }
  await assert.rejects(generatePlan('tarea', assessment, async () => JSON.stringify({ ...draft, scope: ['a'], approved: true })), /plan inválido/);
});

test('el modelo recibe solicitud y evaluación como datos y produce plan versionado', async () => {
  const plan = await generatePlan('Agregar reintentos', assessment, async message => {
    assert.deepEqual(JSON.parse(message), { request: 'Agregar reintentos', assessment, selectedRoute: 'task' });
    return JSON.stringify(draft);
  });
  assert.equal(plan.version, 1);
  assert.equal(plan.digest.length, 64);
  assert.equal(plan.inputDigest?.length, 64);
  assert.deepEqual(plan, versionPlan(draft, 1, plan.inputDigest));
});

test('rechaza resultados incompletos, permisos inventados y formatos inválidos', () => {
  for (const value of [null, [], { ...draft, scope: '' }, { ...draft, steps: [] }, { ...draft, acceptanceCriteria: [] }, { ...draft, risks: [4] }, { ...draft, approved: true }, { ...draft, steps: Array(13).fill('x') }]) {
    assert.throws(() => parsePlan(JSON.stringify(value)), /plan inválido/);
  }
  assert.throws(() => parsePlan('not json'), /plan inválido/);
});

test('la aprobación corresponde solo al contenido y versión revisados', async () => {
  const plan = versionPlan(draft);
  const decision = await reviewPlan(plan, async description => {
    assert.match(description, /Agregar reintentos/);
    assert.match(description, /sin ejecución/);
    return 's';
  });
  assert.equal(isPlanApproved(plan, decision), true);
  assert.equal(isPlanApproved(versionPlan(draft, 2), decision), false);
  assert.equal(isPlanApproved(versionPlan({ ...draft, scope: 'Toda la aplicación' }), decision), false);
  assert.equal(isPlanApproved({ ...plan, scope: 'Toda la aplicación' }, decision), false);
  assert.equal(isPlanApproved(plan, { status: 'cancelled' }), false);
});

test('mutación mientras espera aprobación bloquea el plan', async () => {
  const plan = versionPlan(draft);
  await assert.rejects(reviewPlan(plan, async () => { plan.steps.push('Otro paso'); return 's'; }), /plan cambió/);
});

test('incógnitas bloqueantes no presentan una aprobación', async () => {
  const plan = versionPlan({ ...draft, unknowns: ['¿Cuántos reintentos?'] });
  assert.deepEqual(await reviewPlan(plan, async () => { assert.fail('no preguntar'); }), { status: 'needs-clarification' });
  assert.equal(isPlanApproved(plan, { status: 'approved', version: plan.version, digest: plan.digest }), false);
  await assert.rejects(generatePlan('tarea', { ...assessment, recommendedRoute: 'clarify' }, async () => { assert.fail('no llamar modelo'); }), /aclaración/);
});

test('rechazo, fallo del modelo y cancelación nunca producen plan aprobado', async () => {
  for (const answer of ['', 'n', 'yes']) assert.deepEqual(await reviewPlan(versionPlan(draft), async () => answer), { status: 'cancelled' });
  await assert.rejects(generatePlan('tarea', assessment, async () => { throw new Error('provider failure'); }), /provider failure/);
  const c = new AbortController();
  await assert.rejects(generatePlan('tarea', assessment, async () => { c.abort(); return JSON.stringify(draft); }, c.signal), /cancelada/);
  await assert.rejects(reviewPlan(versionPlan(draft), async () => { assert.fail('no preguntar'); }, c.signal), /cancelada/);
  const d = new AbortController();
  await assert.rejects(reviewPlan(versionPlan(draft), async () => { d.abort(); return 's'; }, d.signal), /cancelada/);
});

test('el digest del plan vincula también la solicitud y el contexto de entrada', async () => {
  const first = await generatePlan('tarea', assessment, async message => {
    assert.deepEqual(JSON.parse(message).context, [{ path: 'src/a.ts', content: 'v1' }]);
    return JSON.stringify(draft);
  }, undefined, { entries: [{ path: 'src/a.ts', content: 'v1' }], bytes: 0, digest: '' });
  const second = await generatePlan('tarea', assessment, async () => JSON.stringify(draft), undefined,
    { entries: [{ path: 'src/a.ts', content: 'v2' }], bytes: 0, digest: '' });
  const decision = await reviewPlan(first, async () => 's');
  assert.notEqual(first.inputDigest, second.inputDigest);
  assert.equal(isPlanApproved(second, decision), false);
});
