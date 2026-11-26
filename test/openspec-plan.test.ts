import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { planOpenSpec, SDD_PLANNER_SYSTEM_PROMPT } from '../src/openspec-plan.ts';
import { snapshotOpenSpec } from '../src/openspec-inspect.ts';
import { hasVerificationContract, isPlanApproved } from '../src/plan.ts';
import { collectContext } from '../src/context-engine.ts';

const prefix='openspec/changes/demo/';
const files=['proposal.md','design.md','tasks.md','specs/greeting/spec.md'].map(p=>prefix+p);
const draft={objective:'Implement greeting',scope:'Greeting only',steps:['Inspect code and implement '+files[3]],acceptanceCriteria:['Greeting matches '+files[3]],risks:[],assumptions:[],unknowns:[]};
function fixture(t:{after:(fn:()=>void)=>void}) {
  const cwd=mkdtempSync(join(tmpdir(),'gear-sdd-plan-'));
  t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  mkdirSync(join(cwd,prefix,'specs/greeting'),{recursive:true});
  writeFileSync(join(cwd,'openspec/config.yaml'),'schema: spec-driven\n');
  for(const file of files)writeFileSync(join(cwd,file),'Original '+file);
  writeFileSync(join(cwd,'README.md'),'Project context');
  const script=join(cwd,'fake.js');
  const writeProvider=(artifacts:unknown,valid=true)=>writeFileSync(script,
    'const a=process.argv.slice(2), root={path:process.cwd(),source:"nearest"};'+
    'if(a[0]==="--version")console.log("2.2.0");else if(a[0]==="status")console.log(JSON.stringify({root,changeName:"demo",isPlanningComplete:true,artifacts:'+JSON.stringify(artifacts)+'}));'+
    'else if(a[0]==="validate"){console.log(JSON.stringify({root,version:"1.0",items:[{id:"demo",type:"change",valid:'+valid+'}]}));process.exitCode='+Number(!valid)+';}else throw Error("unexpected command");');
  const artifacts=['proposal','design','tasks','specs'].map(id=>({id,status:'done'}));
  writeProvider(artifacts);
  const options={cwd,script,change:'demo',files,interactive:true,approve:async(_description:string)=>true,
    ask:async(_description:string)=>'s',complete:async(_message:string)=>JSON.stringify(draft)};
  return {cwd,options,writeProvider,artifacts};
}

test('SDD plan vincula el árbol y contexto exactos, exige revisión y disclosure separados, no ejecuta',async t=>{
  const f=fixture(t),calls:string[]=[];
  const before=snapshotOpenSpec(f.cwd,'demo').digest;
  let sent='';
  const result=await planOpenSpec({...f.options,
    approve:async()=>{calls.push('provider');return true;},
    ask:async description=>{
      if(description.includes('confirmar revisión'))calls.push('review');
      else if(description.includes('Enviar al planificador SDD'))calls.push('disclosure');
      else if(description.includes('Plan propuesto'))calls.push('plan');
      else assert.fail('unknown gate');
      return 's';
    },
    complete:async message=>{
      calls.push('model');sent=message;
      const payload=JSON.parse(message);
      assert.equal(payload.selectedRoute,'sdd');
      assert.equal(payload.source.treeDigest,before);
      assert.equal(payload.source.contextDigest,collectContext(f.cwd,files).digest);
      assert.ok(files.every(path=>payload.context.some((e:{path:string})=>e.path===path)));
      return JSON.stringify(draft);
    }});
  assert.deepEqual(calls,['provider','review','disclosure','model','plan']);
  assert.equal(result.status,'planned');
  if(!('plan' in result))assert.fail('plan missing');
  assert.equal(result.plan.inputDigest,createHash('sha256').update(sent).digest('hex'));
  assert.equal(isPlanApproved(result.plan,result.planDecision),true);
  assert.equal(hasVerificationContract(result.plan,collectContext(f.cwd,files)),false);
  assert.equal(snapshotOpenSpec(f.cwd,'demo').digest,before);
  assert.equal(readFileSync(join(f.cwd,'README.md'),'utf8'),'Project context');
  assert.match(SDD_PLANNER_SYSTEM_PROMPT,/no genera, modifica, aplica/);
});

test('rechazo de revisión o disclosure no inicializa modelo; rechazo final no produce planned',async t=>{
  const f=fixture(t);
  const fail=async()=>assert.fail('model must not run');
  for(const gate of [1,2]){
    let calls=0;
    assert.deepEqual(await planOpenSpec({...f.options,ask:async()=>++calls===gate?'n':'s',complete:fail}),{status:'cancelled'});
  }
  let calls=0;
  const denied=await planOpenSpec({...f.options,ask:async()=>++calls===3?'n':'s'});
  assert.equal(denied.status,'cancelled');
  assert.equal((await planOpenSpec({...f.options,complete:async()=>JSON.stringify({...draft,unknowns:['Missing source context']})})).status,'needs-clarification');
  await assert.rejects(planOpenSpec({...f.options,interactive:false,complete:fail}),/terminal interactiva/);
});

test('plan SDD rechaza specs omitidas, artefactos skipped y validación fallida',async t=>{
  const f=fixture(t),fail=async()=>assert.fail('model must not run');
  const extra=prefix+'specs/second/spec.md';
  mkdirSync(join(f.cwd,prefix,'specs/second'));writeFileSync(join(f.cwd,extra),'second');
  await assert.rejects(planOpenSpec({...f.options,complete:fail,approve:async()=>assert.fail('provider must not start')}),/todos los artefactos/);
  const all=[...files,extra];
  f.writeProvider(f.artifacts.map(a=>a.id==='specs'?{...a,status:'skipped'}:a));
  await assert.rejects(planOpenSpec({...f.options,files:all,complete:fail}),/sin skip/);
  f.writeProvider(f.artifacts,false);
  await assert.rejects(planOpenSpec({...f.options,files:all,complete:fail}),/validación estructural/);
});

test('mutaciones en revisión, disclosure, modelo o gate final invalidan el plan',async t=>{
  const f=fixture(t),target=join(f.cwd,files[0]);
  const original=readFileSync(target,'utf8');
  for(const gate of [1,2,3]){
    let calls=0,modelCalls=0;
    await assert.rejects(planOpenSpec({...f.options,ask:async()=>{
      if(++calls===gate)writeFileSync(target,'changed');return 's';
    },complete:async()=>{modelCalls++;return JSON.stringify(draft);}}),/cambiaron/);
    assert.equal(modelCalls,gate===3?1:0);
    writeFileSync(target,original);
  }
  await assert.rejects(planOpenSpec({...f.options,complete:async()=>{
    writeFileSync(join(f.cwd,'README.md'),'changed during model');return JSON.stringify(draft);
  }}),/cambiaron/);
});

test('respuesta inválida o cancelación no produce aprobación',async t=>{
  const f=fixture(t);
  await assert.rejects(planOpenSpec({...f.options,complete:async()=>JSON.stringify({...draft,approved:true})}),/plan inválido/);
  const controller=new AbortController();
  await assert.rejects(planOpenSpec({...f.options,signal:controller.signal,complete:async()=>{
    controller.abort();return JSON.stringify(draft);
  }}),/cancelada/);
});
