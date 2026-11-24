import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkflowJournal, inspectWorkflow, listWorkflows } from '../src/workflow-journal.ts';
import { versionPlan } from '../src/plan.ts';
import { createYtkProvider } from '../src/memory/ytk.ts';
import { readMemoryConfig } from '../src/memory/config.ts';
import { latestCheckpoint, memoryScope, readCheckpoint } from '../src/memory/checkpoint.ts';
import { openWorkflowMemory, recoverFromMemory } from '../src/memory/workflow-memory.ts';

function fixture(t: {after:(fn:()=>void)=>void}) {
  const cwd=realpathSync(mkdtempSync(join(tmpdir(),'gear-checkpoints-')));
  const agentDir=join(cwd,'user'),dbdir=join(cwd,'.ytk-memory'),database=join(dbdir,'memory.sqlite');
  mkdirSync(agentDir);mkdirSync(dbdir);writeFileSync(database,'fixture');
  writeFileSync(join(cwd,'retry.js'),'fixture');
  writeFileSync(join(agentDir,'memory.json'),JSON.stringify({workspaces:{[cwd]:{provider:'ytk',command:process.execPath,project:'fixture',database,area:'dev'}}}));
  const journal=createWorkflowJournal(cwd,agentDir);
  t.after(()=>{journal.close();rmSync(cwd,{recursive:true,force:true});});
  for(const phase of ['classifying','route-review','context-review','planning','plan-review'] as const)journal.transition(phase);
  const plan=versionPlan({objective:'Retry HTTP',scope:'retry.js',steps:['Inspect current code','Implement retry'],acceptanceCriteria:['test passes'],risks:[],assumptions:[],unknowns:[]});
  const stored=new Map<string,Record<string,unknown>>();
  let writes=0,closed=0,finishes=0,fail=false;
  const connect: typeof import('../src/memory/ytk.ts').connectYtk=async(config,_signal,allowWrites)=>createYtkProvider(config,async(name,args)=>{
    if(name==='memory_session_start')return {sessionId:'s1',entries:[]};
    if(name==='memory_save'){
      writes++;
      if(fail)throw new Error('uncertain write');
      const id='m'+writes;
      stored.set(id,{id,projectId:'fixture',area:'dev',status:'active',type:args.type,title:args.title,content:args.content,subjectKey:args.subjectKey});
      return {stored:true,entryId:id};
    }
    if(name==='memory_get')return {entry:stored.get(String(args.memoryId))};
    if(name==='memory_session_finish'){finishes++;return {sessionId:'s1',summaryStored:false};}
    assert.fail('Unexpected MCP call');
  },async()=>{},async()=>{closed++;},allowWrites);
  const warnings:string[]=[];
  const options={cwd,agentDir,signal:new AbortController().signal,ask:async(_text:string)=>'s',warn:(s:string)=>warnings.push(s),connect};
  return {cwd,agentDir,journal,plan,stored,options,warnings,counts:()=>({writes,closed,finishes}),fail:()=>{fail=true;}};
}
test('persist confirmed plan before effects, later checkpoint, recover without original prompt',async t=>{
  const f=fixture(t);
  const memory=await openWorkflowMemory(f.options,f.journal,f.plan,['retry.js']);
  assert.ok(memory);
  try{
    await memory.checkpoint('plan','No implementation confirmed');
    f.journal.transition('execution-review');f.journal.transition('executing');
    await memory.checkpoint('execution','Executor returned; inspect remaining work');
  }finally{await memory.close();}
  f.journal.close();
  const original=inspectWorkflow(f.cwd,f.agentDir,f.journal.id);
  assert.equal(latestCheckpoint(original)?.phase,'execution');
  assert.equal(f.stored.size,2);
  assert.equal(f.counts().finishes,1);
  assert.ok(listWorkflows(f.cwd,f.agentDir).some(row=>'hasCheckpoint' in row&&row.hasCheckpoint));
  const restored=await recoverFromMemory(f.options,f.journal.id,[]);
  assert.ok(restored);
  assert.match(restored.remaining,/Retry HTTP/);
  assert.match(restored.remaining,/No repitas efectos/);
  assert.deepEqual(restored.files,['retry.js']);
  assert.deepEqual(inspectWorkflow(f.cwd,f.agentDir,f.journal.id),original);
  assert.equal(f.counts().closed,2);
  assert.ok(original.events.every(e=>!JSON.stringify(e).includes('Retry HTTP')));
});
test('wrong scope, tampered memory and invalid source do not recover',async t=>{
  const f=fixture(t);
  const memory=await openWorkflowMemory(f.options,f.journal,f.plan,['retry.js']);
  assert.ok(memory);
  try{await memory.checkpoint('plan','Plan only');}finally{await memory.close();}
  const record=inspectWorkflow(f.cwd,f.agentDir,f.journal.id);
  const provider=await f.options.connect(readMemoryConfig(f.cwd,f.agentDir)!);
  try{
    await assert.rejects(readCheckpoint(provider,record,'0'.repeat(64)),/scope/);
    const ref=latestCheckpoint(record)!;
    const original=f.stored.get(ref.entryId)!;
    f.stored.set(ref.entryId,{...original,content:String(original.content)+' '});
    await assert.rejects(readCheckpoint(provider,record,memoryScope(readMemoryConfig(f.cwd,f.agentDir)!)),/alterado/);
  }finally{await provider.close();}
  f.journal.finish('cancelled');
  await assert.rejects(recoverFromMemory(f.options,f.journal.id,[]),/cerrado/);
});
test('declined consent, write uncertainty and degraded provider never retry or publish false ref',async t=>{
  const f=fixture(t);
  assert.equal(await openWorkflowMemory({...f.options,ask:async()=> 'n'},f.journal,f.plan,['retry.js']),undefined);
  assert.equal(f.counts().writes,0);
  const memory=await openWorkflowMemory(f.options,f.journal,f.plan,['retry.js']);
  assert.ok(memory);f.fail();
  try{await memory.checkpoint('plan','Plan only');await memory.checkpoint('plan','No retry');}finally{await memory.close();}
  assert.equal(f.counts().writes,1);
  assert.equal(f.warnings.length,1);
  assert.equal(latestCheckpoint(inspectWorkflow(f.cwd,f.agentDir,f.journal.id)),undefined);
});
test('recovery approval rejection and parent mutation are fail closed',async t=>{
  const f=fixture(t);
  const memory=await openWorkflowMemory(f.options,f.journal,f.plan,['retry.js']);
  assert.ok(memory);
  try{await memory.checkpoint('plan','Plan only');}finally{await memory.close();}
  let calls=0;
  assert.equal(await recoverFromMemory({...f.options,ask:async()=>++calls===1?'s':'n'},f.journal.id,[]),undefined);
  calls=0;
  await assert.rejects(recoverFromMemory({...f.options,ask:async()=>{
    if(++calls===2)f.journal.transition('execution-review');
    return 's';
  }},f.journal.id,[]),/registro anterior cambió/);
});
