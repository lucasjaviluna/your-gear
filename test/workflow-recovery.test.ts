import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkflowJournal, inspectWorkflow, listWorkflows, type WorkflowJournal } from '../src/workflow-journal.ts';
import { prepareRecovery, assertRecoverySource, recoveryRequest } from '../src/workflow-recovery.ts';

function fixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(),'gear-recover-'));
  const cwd = join(root,'work'), other = join(root,'other'), agentDir = join(root,'user');
  mkdirSync(cwd); mkdirSync(other);
  const journal = createWorkflowJournal(cwd,agentDir);
  t.after(() => { journal.close(); rmSync(root,{recursive:true,force:true}); });
  return { cwd, other, agentDir, journal, input: { cwd, agentDir, id: journal.id, remaining: 'Trabajo pendiente', files: ['src/a.ts'] } };
}
function executing(j: WorkflowJournal) {
  for (const phase of ['classifying','route-review','context-review','planning','plan-review','execution-review','executing'] as const) j.transition(phase);
}
test('recuperación enlaza nuevo UUID sin modificar el anterior ni importar permisos', async t => {
  const { cwd, agentDir, journal, input } = fixture(t);
  executing(journal);
  journal.record({ kind:'tool-approval', approved:true });
  journal.close();
  const original = inspectWorkflow(cwd,agentDir,journal.id);
  const link = await prepareRecovery(input,async description => {
    assert.match(description,/procesos terminaron/);
    assert.match(description,/nueva clasificación/);
    return 's';
  });
  assert.ok(link);
  assert.deepEqual(Object.keys(link).sort(),['parentDigest','parentId']);
  const child = createWorkflowJournal(cwd,agentDir);
  try { child.record({kind:'recovery',...link}); child.transition('classifying'); }
  finally { child.close(); }
  assert.notEqual(child.id,journal.id);
  assert.deepEqual(inspectWorkflow(cwd,agentDir,journal.id),original);
  const record = inspectWorkflow(cwd,agentDir,child.id);
  assert.equal(record.stage,'classifying');
  assert.equal(record.effectsMayHaveOccurred,false);
  assert.ok(record.events.some(e=>'metadata' in e && e.metadata.kind==='recovery'));
  assert.ok(!record.events.some(e=>'metadata' in e && e.metadata.kind==='tool-approval'));
});
test('rechazo, terminal, workspace ajeno y contexto ausente no crean nuevo intento', async t => {
  const { cwd, other, agentDir, journal, input } = fixture(t);
  executing(journal);
  const noAsk = async () => { assert.fail('no debe solicitar aprobación'); };
  assert.equal(await prepareRecovery(input,async ()=>'n'),undefined);
  await assert.rejects(prepareRecovery({...input,files:[]},noAsk),/al menos un archivo/);
  await assert.rejects(prepareRecovery({...input,cwd:other},noAsk));
  await assert.rejects(prepareRecovery({...input,remaining:'   '},noAsk),/trabajo pendiente/);
  journal.finish('cancelled');
  await assert.rejects(prepareRecovery(input,noAsk),/cerrado/);
  assert.equal(listWorkflows(cwd,agentDir).length,1);
});
test('cambio del registro durante aprobación invalida recuperación', async t => {
  const { journal,input } = fixture(t);
  await assert.rejects(prepareRecovery(input,async()=>{journal.transition('classifying');return 's';}),/registro anterior cambió/);
});
test('cambio posterior invalida autorización de nuevas operaciones', async t => {
  const { cwd,agentDir,journal,input } = fixture(t);
  const link = await prepareRecovery(input,async()=> 's');
  assert.ok(link);
  assertRecoverySource(cwd,agentDir,link);
  journal.transition('classifying');
  assert.throws(()=>assertRecoverySource(cwd,agentDir,link),/registro anterior cambió/);
});
test('cancelación no produce enlace; solicitud nueva se acota al trabajo restante', async t => {
  const { input } = fixture(t);
  const controller = new AbortController();
  await assert.rejects(prepareRecovery(input,async()=>{controller.abort();return 's';},controller.signal),/cancelada/);
  assert.match(recoveryRequest('Solo documentar el cambio'),/Solo documentar el cambio/);
  assert.match(recoveryRequest('Solo documentar el cambio'),/no repitas efectos/);
  assert.throws(()=>recoveryRequest('a'.repeat(20000)),/demasiado larga/);
});
