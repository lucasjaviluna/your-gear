import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseVerification, verifyTask, type Evidence } from '../src/verification.ts';
import { versionPlan } from '../src/plan.ts';
import type { TestEvidence } from '../src/verification-evidence.ts';

const passed: TestEvidence = { path: 'a.test.cjs', status: 'exit-zero', exitCode: 0, stdout: 'actual result', stderr: '', outputTruncated: false };
const file = { id: 'f1', kind: 'file' as const, path: 'a.ts', content: 'new', changed: true };
const evidence: Evidence[] = [file, { id: 't1', kind: 'test', ...passed }];
const response = JSON.stringify({ criteria: [{ index: 0, status: 'supported', evidenceIds: ['f1','t1'], reason: 'Evidence' }] });
function fixture() {
  return { request: 'change', plan: versionPlan({ objective: 'change', scope: 'file', steps: ['edit'], acceptanceCriteria: ['criterion'], risks: [], assumptions: [], unknowns: [] }),
    report: { summary: 'executor claims success', blockedCalls: 0, toolErrors: 0 },
    before: { entries: [{ path: 'a.ts', content: 'old' }], bytes: 1, digest: 'old' },
    after: { entries: [{ path: 'a.ts', content: 'new' }], bytes: 1, digest: 'new' }, tests: [passed] };
}
test('parser exige todos los criterios y evidencia existente; no acepta autorización del modelo', () => {
  assert.equal(parseVerification(response, 1, evidence)[0].status, 'supported');
  for (const invalid of [
    { criteria: [] }, { criteria: [{ index: 1, status: 'supported', evidenceIds: ['f1'], reason: 'x' }] },
    { criteria: [{ index: 0, status: 'supported', evidenceIds: ['fake'], reason: 'x' }] },
    { criteria: [{ index: 0, status: 'supported', evidenceIds: [], reason: 'x' }] },
    { criteria: JSON.parse(response).criteria, approved: true },
  ]) assert.throws(() => parseVerification(JSON.stringify(invalid), 1, evidence), /inválida/);
});
test('aceptación final requiere evidencia enviada con consentimiento y decisión humana separada', async () => {
  const calls: string[] = [];
  const result = await verifyTask(fixture(), {
    ask: async prompt => { calls.push(prompt.includes('Enviar al modelo') ? 'consent' : 'review'); return 's'; },
    complete: async message => { calls.push('llm'); assert.equal(JSON.parse(message).evidence[1].stdout, 'actual result'); return response; },
    refreshDigest: () => 'new',
  });
  assert.deepEqual(calls, ['consent','llm','review']);
  assert.equal(result.status, 'accepted');
  assert.equal('stdout' in result.evidence[1], false);
});
test('sin consentimiento no llama modelo y rechazo final no acepta', async () => {
  const opts = { refreshDigest: () => 'new', complete: async () => response };
  assert.equal((await verifyTask(fixture(), { ...opts, ask: async () => 'n', complete: async () => { assert.fail('no provider'); } })).status, 'cancelled');
  let calls = 0;
  assert.equal((await verifyTask(fixture(), { ...opts, ask: async () => calls++ === 0 ? 's' : 'n' })).status, 'needs-review');
});
test('fallos, ausencia de pruebas, truncamiento y bloqueos impiden aceptación incluso si LLM dice supported', async () => {
  for (const input of [
    { ...fixture(), tests: [] },
    { ...fixture(), tests: [{ ...passed, status: 'failed' as const, exitCode: 1 }] },
    { ...fixture(), tests: [{ ...passed, outputTruncated: true }] },
    { ...fixture(), report: { ...fixture().report, blockedCalls: 1 } },
  ]) {
    let calls = 0;
    const result = await verifyTask(input, { ask: async () => { calls++; return 's'; }, refreshDigest: () => 'new',
      complete: async () => JSON.stringify({ criteria: [{ index: 0, status: 'supported', evidenceIds: ['f1'], reason: 'file' }] }) });
    assert.equal(result.status, 'inconclusive');
    assert.equal(calls, 1);
  }
});
test('contexto cambiado durante revisión final impide aceptación', async () => {
  let digest = 'new';
  let calls = 0;
  const result = await verifyTask(fixture(), { refreshDigest: () => digest, complete: async () => response,
    ask: async () => { if (calls++) digest = 'changed'; return 's'; } });
  assert.equal(result.status, 'inconclusive');
});
