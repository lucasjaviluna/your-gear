import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssistantMessageEventStream, type AssistantMessage, type Model } from '@earendil-works/pi-ai';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { createClassifierSession, classifyWithSession } from '../src/assessment-agent.ts';
import { reviewRoute } from '../src/route-review.ts';
import { approveContext, collectContext } from '../src/context-engine.ts';
import { createPlannerSession, planWithSession } from '../src/planner-agent.ts';
import { reviewPlan } from '../src/plan.ts';
import { createExecutorSession, executeWithSession } from '../src/executor-agent.ts';
import { executeApprovedTask } from '../src/task-orchestrator.ts';
import { runSelectedTest } from '../src/verification-evidence.ts';
import { createVerifierSession, verifyWithSession } from '../src/verifier-agent.ts';
import { verifyTask } from '../src/verification.ts';
import { createWorkflowJournal, inspectWorkflow } from '../src/workflow-journal.ts';
import { createYtkProvider } from '../src/memory/ytk.ts';
import { openWorkflowMemory, recoverFromMemory } from '../src/memory/workflow-memory.ts';
import { latestCheckpoint } from '../src/memory/checkpoint.ts';
import { prepareRecovery, assertRecoverySource, recoveryRequest, type RecoveryLink } from '../src/workflow-recovery.ts';

const files = ['retry.cjs','README.md','retry.test.cjs'];
const tests = ['retry.test.cjs'];
const implemented = 'module.exports = (fn) => { try { return fn(); } catch { return fn(); } };\n';
const documentation = '# Retry lab\n\nRetry once after an exception; propagate the second error.\n';
const request = 'Implementar un único reintento síncrono ante excepción y documentarlo; mantener el test existente.';
const model = {id:'fake',name:'fake',provider:'openai',api:'openai-completions',baseUrl:'http://localhost',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:10000,maxTokens:1000} as Model<'openai-completions'>;

function streamMessage(content: AssistantMessage['content'], reason: 'stop'|'toolUse' = 'stop') {
  const stream = createAssistantMessageEventStream();
  const message: AssistantMessage = {
    role:'assistant',api:'openai-completions',provider:'openai',model:'fake',content,
    usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},
    stopReason:reason,timestamp:Date.now(),
  };
  stream.push({type:'done',reason,message});
  return stream;
}
const jsonReply = (value:unknown) => () => streamMessage([{type:'text',text:JSON.stringify(value)}]);

async function fixture(t:{after:(fn:()=>void)=>void}) {
  const root=realpathSync(mkdtempSync(join(tmpdir(),'gear-task-integral-')));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const cwd=join(root,'workspace'),agentDir=join(root,'agent'),dbdir=join(cwd,'.ytk-memory');
  mkdirSync(cwd);mkdirSync(agentDir);mkdirSync(dbdir);
  for(const file of files)copyFileSync(new URL('./fixtures/task-lab/'+file,import.meta.url),join(cwd,file));
  const database=join(dbdir,'memory.sqlite');writeFileSync(database,'fixture');
  writeFileSync(join(agentDir,'memory.json'),JSON.stringify({workspaces:{[realpathSync(cwd)]:{provider:'ytk',command:process.execPath,project:'fixture',database,area:'dev'}}}));
  const stored=new Map<string,Record<string,unknown>>();
  let sessions=0;
  const connect:typeof import('../src/memory/ytk.ts').connectYtk=async(config,_signal,allowWrites)=>{
    const sessionId='s'+(++sessions);
    return createYtkProvider(config,async(name,args)=>{
      if(name==='memory_session_start')return {sessionId,entries:[]};
      if(name==='memory_save'){
        const id='m'+(stored.size+1);
        stored.set(id,{id,projectId:'fixture',area:'dev',status:'active',type:args.type,title:args.title,content:args.content,subjectKey:args.subjectKey});
        return {stored:true,entryId:id};
      }
      if(name==='memory_get')return {entry:stored.get(String(args.memoryId))};
      if(name==='memory_session_finish')return {sessionId,summaryStored:false};
      assert.fail('Unexpected memory operation');
    },async()=>{},async()=>{},allowWrites);
  };
  const modelRuntime=await ModelRuntime.create({authPath:join(agentDir,'auth.json'),modelsPath:join(agentDir,'models.json')});
  await modelRuntime.setRuntimeApiKey('openai','fixture-only');
  const signal=new AbortController().signal;
  const options={cwd,agentDir,modelRuntime,model};
  const memoryOptions={cwd,agentDir,signal,connect,warn:(message:string)=>assert.fail(message),ask:async(_description:string)=>'s'};
  const refresh=()=>collectContext(cwd,files,signal);
  return {cwd,agentDir,options,signal,memoryOptions,refresh,stored};
}
type Fixture=Awaited<ReturnType<typeof fixture>>;

/** Integration of real Gear components and Pi sessions; model and YTK replies are fixtures.
 * This composes modules rather than spawning the interactive CLI. */
async function attempt(f:Fixture, task:string, changes:{path:string;content:string}[], opts:{memory:boolean;interrupt?:boolean;recovery?:RecoveryLink;rejectFinal?:boolean}) {
  const {cwd,agentDir,signal,options,refresh}=f;
  const journal=createWorkflowJournal(cwd,agentDir);
  const gates:string[]=[];
  const ask=async(description:string)=>{
    gates.push(description);
    return opts.rejectFinal&&description.includes('Aceptar el resultado')?'n':'s';
  };
  const parentCheck=()=>{if(opts.recovery)assertRecoverySource(cwd,agentDir,opts.recovery);};
  let memory:Awaited<ReturnType<typeof openWorkflowMemory>> = undefined;
  try {
    if(opts.recovery)journal.record({kind:'recovery',...opts.recovery});
    journal.transition('classifying');
    const classifier=await createClassifierSession(options);
    classifier.agent.streamFunction=jsonReply({recommendedRoute:'task',confidence:'high',reasons:['Implementation and tests'],affectedAreas:['retry'],unknowns:[]});
    const assessment=await classifyWithSession(classifier,task,signal);
    journal.transition('route-review');
    const decision=await reviewRoute(assessment,ask,signal);
    assert.equal(decision.status,'selected');
    journal.record({kind:'route',recommended:'task',decision:'task'});
    journal.transition('context-review');
    const before=refresh();
    assert.equal(await approveContext(before,ask,signal),true);
    journal.record({kind:'context',digest:before.digest,files:before.entries.length,approved:true});
    journal.transition('planning');
    const planner=await createPlannerSession(options);
    planner.agent.streamFunction=jsonReply({objective:'Retry once and document',scope:'retry.cjs and README.md',steps:['Inspect current state','Complete missing changes'],
      acceptanceCriteria:['Exactly one retry and propagate second exception','Behavior documented and test unchanged'],risks:[],assumptions:[],unknowns:[],
      evidenceRequirements:[{files:['retry.cjs'],tests},{files:['README.md','retry.test.cjs'],tests:[]}]});
    const plan=await planWithSession(planner,task,assessment,signal,before,tests);
    journal.transition('plan-review');
    const planDecision=await reviewPlan(plan,ask,signal);
    assert.equal(planDecision.status,'approved');
    journal.record({kind:'plan',digest:plan.digest,version:plan.version,criteria:plan.acceptanceCriteria.length,decision:planDecision.status});
    if(opts.memory){
      memory=await openWorkflowMemory({...f.memoryOptions,ask},journal,plan,before.entries.map(e=>e.path));
      assert.ok(memory);
      await memory.checkpoint('plan','No effects confirmed');
    }
    parentCheck();
    journal.transition('execution-review');
    const execution=await executeApprovedTask({request:task,assessment,decision,context:before,plan,planDecision},{
      signal,refreshContext:refresh,ask,
      execute:async message=>{
        parentCheck();
        journal.transition('executing');
        const executor=await createExecutorSession(options,async description=>{
          parentCheck();
          assert.match(description,/write:/);
          gates.push(description);
          journal.record({kind:'tool-approval',approved:true});
          return true;
        },signal);
        let turn=0;
        executor.session.agent.streamFunction=()=>{
          const change=changes[turn++];
          return change?streamMessage([{type:'toolCall',id:'write-'+turn,name:'write',arguments:change}],'toolUse'):
            streamMessage([{type:'text',text:'Fixture edits completed'}]);
        };
        return executeWithSession(executor,message,signal);
      },
    });
    assert.equal(execution.status,'awaiting-verification');
    if(execution.status!=='awaiting-verification')assert.fail('Executor did not run');
    assert.equal(execution.report.blockedCalls,0);
    assert.equal(execution.report.toolErrors,0);
    // Simulate interruption after effects: deliberately leave journal non-terminal.
    // The fixture still cleans up its session/handles; this is not a real process crash.
    if(opts.interrupt)return {id:journal.id,gates,verification:undefined};
    journal.record({kind:'execution',blockedCalls:execution.report.blockedCalls,toolErrors:execution.report.toolErrors});
    await memory?.checkpoint('execution','Executor returned');
    journal.transition('verifying');
    const evidence=await runSelectedTest(cwd,tests[0],async description=>{
      parentCheck();const answer=await ask(description);
      journal.record({kind:'verification-gate',gate:'test',approved:answer==='s'});
      return answer;
    },signal);
    assert.equal(evidence.status,'exit-zero');
    assert.match(evidence.stdout,/# pass 3\b/);
    journal.record({kind:'test',status:evidence.status,exitCode:evidence.exitCode,outputTruncated:evidence.outputTruncated});
    const after=refresh();
    const verification=await verifyTask({request:task,plan,report:execution.report,before,after,tests:[evidence]},{
      ask,signal,refreshDigest:()=>refresh().digest,
      onDecision:(gate,approved)=>{if(approved)parentCheck();journal.record({kind:'verification-gate',gate,approved});},
      complete:async message=>{
        const payload=JSON.parse(message);
        assert.equal(payload.evidence.find((e:{path:string;kind:string})=>e.kind==='test'&&e.path===tests[0]).exitCode,0);
        const verifier=await createVerifierSession(options);
        verifier.agent.streamFunction=jsonReply({criteria:[
          {index:0,status:'supported',evidenceIds:['f1','t1'],reason:'Fixture code and TAP results'},
          {index:1,status:'supported',evidenceIds:['f2','f3'],reason:'Fixture documentation and unchanged test'},
        ]});
        return verifyWithSession(verifier,message,signal);
      },
    });
    journal.record({kind:'verification',status:verification.status,supported:verification.criteria.filter(c=>c.status==='supported').length,total:plan.acceptanceCriteria.length});
    await memory?.checkpoint('verification','Review '+verification.status);
    journal.finish(verification.status);
    return {id:journal.id,gates,verification};
  }finally{
    try{await memory?.close();}finally{journal.close();}
  }
}

test('integrated task: real SDK, real filesystem and tests, fresh human gates, no memory',async t=>{
  const f=await fixture(t);
  const originalTest=readFileSync(join(f.cwd,tests[0]),'utf8');
  const result=await attempt(f,request,[{path:'retry.cjs',content:implemented},{path:'README.md',content:documentation}],{memory:false});
  assert.equal(result.verification?.status,'accepted');
  assert.equal(inspectWorkflow(f.cwd,f.agentDir,result.id).stage,'accepted');
  assert.equal(readFileSync(join(f.cwd,tests[0]),'utf8'),originalTest);
  assert.equal(f.stored.size,0);
  assert.equal(result.gates.filter(g=>g.includes('write:')).length,2);
});

test('recover exact checkpoint after partial effects, replan and approve only remaining write',async t=>{
  const f=await fixture(t);
  const parent=await attempt(f,request,[{path:'retry.cjs',content:implemented}],{memory:true,interrupt:true});
  const record=inspectWorkflow(f.cwd,f.agentDir,parent.id);
  assert.equal(record.complete,false);
  assert.equal(record.effectsMayHaveOccurred,true);
  assert.equal(latestCheckpoint(record)?.phase,'plan');
  assert.equal(readFileSync(join(f.cwd,'retry.cjs'),'utf8'),implemented);
  assert.notEqual(readFileSync(join(f.cwd,'README.md'),'utf8'),documentation);
  const restored=await recoverFromMemory(f.memoryOptions,parent.id,[]);
  assert.ok(restored);
  const link=await prepareRecovery({cwd:f.cwd,agentDir:f.agentDir,id:parent.id,remaining:restored.remaining,files:restored.files},async()=> 's',f.signal);
  assert.ok(link);
  assert.equal(link.parentDigest,restored.parentDigest);
  const child=await attempt(f,recoveryRequest(restored.remaining),[{path:'README.md',content:documentation}],{memory:true,recovery:link});
  assert.notEqual(child.id,parent.id);
  assert.equal(child.verification?.status,'accepted');
  assert.equal(child.gates.filter(g=>g.includes('write:')).length,1);
  assert.equal(readFileSync(join(f.cwd,'retry.cjs'),'utf8'),implemented);
  assert.deepEqual(inspectWorkflow(f.cwd,f.agentDir,parent.id),record);
  const childRecord=inspectWorkflow(f.cwd,f.agentDir,child.id);
  assert.equal(childRecord.stage,'accepted');
  assert.ok(childRecord.events.some(e=>'metadata' in e&&e.metadata.kind==='recovery'&&e.metadata.parentId===parent.id));
  assert.equal(latestCheckpoint(childRecord)?.phase,'verification');
  assert.equal(f.stored.size,4);
});

test('passing tests and supported criteria cannot override a rejected final gate',async t=>{
  const f=await fixture(t);
  const result=await attempt(f,request,[{path:'retry.cjs',content:implemented},{path:'README.md',content:documentation}],{memory:false,rejectFinal:true});
  assert.equal(result.verification?.status,'needs-review');
  assert.equal(inspectWorkflow(f.cwd,f.agentDir,result.id).stage,'needs-review');
});
