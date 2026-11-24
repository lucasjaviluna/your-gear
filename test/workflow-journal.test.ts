import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkflowJournal, inspectWorkflow, listWorkflows, type WorkflowJournal } from '../src/workflow-journal.ts';

function fixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(),'gear-journal-'));
  t.after(() => rmSync(root,{recursive:true,force:true}));
  const cwd = join(root,'work'), other = join(root,'other'), agentDir = join(root,'user');
  mkdirSync(cwd); mkdirSync(other);
  return { cwd, other, agentDir, file: (id: string) => {
    const base = join(agentDir,'workflows');
    return join(base,readdirSync(base)[0],id + '.jsonl');
  }};
}
function start(journal: WorkflowJournal) {
  journal.transition('classifying');
  journal.transition('route-review');
  journal.record({kind:'route',recommended:'task',decision:'task'});
  journal.transition('context-review');
  journal.record({kind:'context',digest:'a'.repeat(64),files:1,approved:true});
  journal.transition('planning');
  journal.transition('plan-review');
  journal.record({kind:'plan',digest:'b'.repeat(64),version:1,criteria:1,decision:'approved'});
  journal.transition('execution-review');
  journal.transition('executing');
}
test('persiste secuencia, decisiones y estado final sin contenido del modelo', t => {
  const { cwd, agentDir, file } = fixture(t);
  const j = createWorkflowJournal(cwd,agentDir);
  try {
    start(j);
    j.record({kind:'tool-approval',approved:true});
    j.record({kind:'execution',blockedCalls:0,toolErrors:0});
    j.transition('verifying');
    j.record({kind:'verification-gate',gate:'test',approved:true});
    j.record({kind:'test',status:'exit-zero',exitCode:0,outputTruncated:false});
    j.record({kind:'verification-gate',gate:'disclosure',approved:true});
    j.record({kind:'verification-gate',gate:'final-review',approved:true});
    j.record({kind:'verification',status:'accepted',supported:1,total:1});
    j.finish('accepted');
    assert.throws(() => j.transition('executing'), /Transición/);
    assert.throws(() => j.record({kind:'tool-approval',approved:true}), /Metadatos/);
  } finally { j.close(); }
  const record = inspectWorkflow(cwd,agentDir,j.id);
  assert.equal(record.stage,'accepted');
  assert.equal(record.complete,true);
  assert.equal(record.effectsMayHaveOccurred,true);
  assert.deepEqual(record.events.map(e=>e.seq), record.events.map((_,i)=>i));
  assert.doesNotMatch(readFileSync(file(j.id),'utf8'), /summary|stdout|stderr|request|content|apiKey/);
  assert.equal(listWorkflows(cwd,agentDir)[0].id,j.id);
});
test('consulta de registro sin cierre detecta posibles efectos y nunca lo modifica', t => {
  const { cwd, agentDir, file } = fixture(t);
  const j = createWorkflowJournal(cwd,agentDir);
  try { start(j); j.record({kind:'tool-approval',approved:true}); } finally { j.close(); }
  const old = readFileSync(file(j.id),'utf8');
  const state = inspectWorkflow(cwd,agentDir,j.id);
  assert.equal(state.stage,'executing');
  assert.equal(state.complete,false);
  assert.equal(state.effectsMayHaveOccurred,true);
  assert.equal(readFileSync(file(j.id),'utf8'),old);
});
test('aislamiento por workspace y UUID; consulta vacía no crea archivos', t => {
  const { cwd, other, agentDir } = fixture(t);
  assert.deepEqual(listWorkflows(cwd,agentDir),[]);
  assert.equal(existsSync(agentDir),false);
  const a = createWorkflowJournal(cwd,agentDir);
  const b = createWorkflowJournal(cwd,agentDir);
  try { a.finish('cancelled'); b.transition('classifying'); }
  finally { a.close(); b.close(); }
  assert.notEqual(a.id,b.id);
  assert.equal(listWorkflows(cwd,agentDir).length,2);
  assert.deepEqual(listWorkflows(other,agentDir),[]);
  assert.throws(()=>inspectWorkflow(other,agentDir,a.id));
  assert.throws(()=>inspectWorkflow(cwd,agentDir,'../outside'), /ID de workflow inválido/);
  assert.equal(inspectWorkflow(cwd,agentDir,a.id).effectsMayHaveOccurred,false);
});
test('rechaza transiciones y metadatos arbitrarios antes de persistir', t => {
  const { cwd, agentDir, file } = fixture(t);
  const j = createWorkflowJournal(cwd,agentDir);
  try {
    assert.throws(()=>j.transition('executing'), /Transición/);
    j.transition('classifying');
    j.transition('route-review');
    const injected = {kind:'route',recommended:'task',decision:'task',secret:'PRIVATE_MARKER'} as const;
    assert.throws(()=>j.record(injected), /Metadatos/);
    j.finish('failed');
  } finally { j.close(); }
  assert.doesNotMatch(readFileSync(file(j.id),'utf8'),/PRIVATE_MARKER/);
});
test('registro parcial, secuencia manipulada y archivo excesivo no se reparan ni se reutilizan', t => {
  const { cwd, agentDir, file } = fixture(t);
  const j = createWorkflowJournal(cwd,agentDir);
  j.close();
  const path = file(j.id), original = readFileSync(path,'utf8');
  appendFileSync(path,'{"seq":1');
  const partial = readFileSync(path,'utf8');
  assert.throws(()=>inspectWorkflow(cwd,agentDir,j.id),/incompleto/);
  assert.equal(listWorkflows(cwd,agentDir)[0].stage,'unreadable');
  assert.equal(readFileSync(path,'utf8'),partial);
  writeFileSync(path,original + JSON.stringify({seq:9,at:new Date().toISOString(),stage:'accepted'})+'\n');
  assert.throws(()=>inspectWorkflow(cwd,agentDir,j.id),/Evento inválido/);
  writeFileSync(path,'x'.repeat(256*1024+1));
  assert.throws(()=>inspectWorkflow(cwd,agentDir,j.id),/Registro no permitido/);
});
