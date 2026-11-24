import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectYtk } from '../dist/memory/ytk.js';
import { createWorkflowJournal, inspectWorkflow } from '../dist/workflow-journal.js';
import { storeCheckpoint, readCheckpoint, memoryScope } from '../dist/memory/checkpoint.js';

if(!process.argv[2])throw Error('Uso: npm run smoke:ytk -- /ruta/absoluta/ytk-memory');
const command=realpathSync(process.argv[2]);
const cwd=realpathSync(mkdtempSync(join(tmpdir(),'gear-ytk-smoke-')));
let journal,provider;
try{
  const dir=join(cwd,'.ytk-memory');
  mkdirSync(dir);
  const database=join(dir,'memory.sqlite');
  writeFileSync(database,'');
  writeFileSync(join(cwd,'.ytk-memory.json'),JSON.stringify({project_slug:'gear-smoke',database,default_area:'smoke'}));
  const config={cwd,command,database,project:'gear-smoke',area:'smoke'};
  journal=createWorkflowJournal(cwd,join(cwd,'user'));
  for(const phase of ['classifying','route-review','context-review','planning','plan-review'])journal.transition(phase);
  provider=await connectYtk(config,undefined,true);
  const session=await provider.start();
  await storeCheckpoint(provider,session.id,journal,memoryScope(config),'plan',
    {objective:'Smoke retry',scope:'retry.js',steps:['Inspect'],criteria:['Test passes'],files:['retry.js']},'No implementation');
  await provider.finish(session.id);
  await provider.close();provider=undefined;
  const id=journal.id;journal.close();journal=undefined;
  provider=await connectYtk(config);
  const record=inspectWorkflow(cwd,join(cwd,'user'),id);
  assert.equal((await readCheckpoint(provider,record,memoryScope(config))).brief.objective,'Smoke retry');
  console.log('YTK real: persistencia y recuperación por referencia exacta OK.');
}finally{
  try{await provider?.close();}finally{journal?.close();rmSync(cwd,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
