import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectContext } from '../src/context-engine.ts';
import { generatePlan, reviewPlan } from '../src/plan.ts';
import { executeApprovedTask, type ExecutionInput } from '../src/task-orchestrator.ts';
import type { Assessment } from '../src/assessment.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function fixture(t: { after: (fn: () => void) => void }) {
  const cwd = mkdtempSync(join(tmpdir(), 'gear-task-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  writeFileSync(join(cwd, 'README.md'), 'original');
  const context = collectContext(cwd);
  const assessment: Assessment = { recommendedRoute: 'task', source: 'llm', confidence: 'medium', reasons: ['Varios pasos'], affectedAreas: [], unknowns: [] };
  const request = 'Implementar un cambio y documentarlo';
  const plan = await generatePlan(request, assessment, async () => JSON.stringify({
    objective: 'Cambio', scope: 'README', steps: ['Editar'], acceptanceCriteria: ['Texto actualizado'], risks: [], assumptions: [], unknowns: [],
  }), undefined, context);
  const planDecision = await reviewPlan(plan, async () => 's');
  const input: ExecutionInput = { request, assessment, decision: { status: 'selected', route: 'task', source: 'accepted' }, context, plan, planDecision };
  return { cwd, input, refreshContext: () => collectContext(cwd) };
}
const report = { summary: 'Cambios propuestos', blockedCalls: 0, toolErrors: 0 };

test('solo inicia tras aprobación exacta y gate separado; nunca declara verificado', async t => {
  const { input, refreshContext } = await fixture(t);
  const calls: string[] = [];
  const result = await executeApprovedTask(input, {
    refreshContext, ask: async prompt => { assert.match(prompt, /Iniciar ejecución experimental/); calls.push('gate'); return 's'; },
    execute: async message => { calls.push('execute'); assert.deepEqual(JSON.parse(message).plan, input.plan); return report; },
  });
  assert.deepEqual(calls, ['gate', 'execute']);
  assert.deepEqual(result, { status: 'awaiting-verification', report });
});

test('rechazo, cambio de ruta o plan y falta de aprobación no ejecutan', async t => {
  const { input, refreshContext } = await fixture(t);
  const fail = async () => { assert.fail('no ejecutar'); };
  assert.equal((await executeApprovedTask(input, { refreshContext, ask: async () => 'n', execute: fail })).status, 'cancelled');
  for (const altered of [
    { ...input, request: 'otro objetivo' },
    { ...input, plan: { ...input.plan, scope: 'otro alcance' } },
    { ...input, planDecision: { status: 'cancelled' as const } },
    { ...input, decision: { status: 'selected' as const, route: 'simple' as const, source: 'manual' as const } },
    { ...input, assessment: { ...input.assessment, recommendedRoute: 'sdd' as const } },
  ]) {
    assert.equal((await executeApprovedTask(altered, { refreshContext, ask: fail, execute: fail })).status, 'blocked');
  }
});

test('cambio de contexto antes o durante gate impide ejecución', async t => {
  const { cwd, input, refreshContext } = await fixture(t);
  const fail = async () => { assert.fail('no ejecutar'); };
  writeFileSync(join(cwd, 'README.md'), 'changed');
  assert.equal((await executeApprovedTask(input, { refreshContext, ask: fail, execute: fail })).status, 'blocked');
  writeFileSync(join(cwd, 'README.md'), 'original');
  assert.equal((await executeApprovedTask(input, { refreshContext, ask: async () => {
    writeFileSync(join(cwd, 'README.md'), 'changed again'); return 's';
  }, execute: fail })).status, 'blocked');
});

test('cancelación tardía invalida inicio y fallo de executor no produce resultado exitoso', async t => {
  const { input, refreshContext } = await fixture(t);
  const c = new AbortController();
  await assert.rejects(executeApprovedTask(input, { refreshContext, signal: c.signal,
    ask: async () => { c.abort(); return 's'; }, execute: async () => { assert.fail('no ejecutar'); }
  }), /cancelada/);
  await assert.rejects(executeApprovedTask(input, { refreshContext, ask: async () => 's',
    execute: async () => { throw new Error('provider failure'); }
  }), /provider failure/);
});
