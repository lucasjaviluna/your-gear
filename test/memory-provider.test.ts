import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readMemoryConfig, type MemoryConfig } from '../src/memory/config.ts';
import { createYtkProvider, connectYtk } from '../src/memory/ytk.ts';
import { parseMemoryCommand, runMemoryCommand } from '../src/memory/commands.ts';

const entry = {id:'m1',projectId:'fixture',area:'dev',status:'active',type:'summary',title:'Title',content:'Evidence',subjectKey:'task:1'};
const draft = {type:'summary' as const,title:'Title',content:'Checkpoint',subjectKey:'task:1'};
const noop = async () => {};
function fixture(t: {after: (fn: () => void) => void}) {
  const root = mkdtempSync(join(tmpdir(),'gear-memory-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const cwd=realpathSync(root),agentDir=join(cwd,'user'),database=join(cwd,'memory.sqlite');
  mkdirSync(agentDir);writeFileSync(database,'fixture');
  const config = {provider:'ytk',command:process.execPath,project:'fixture',database,area:'dev'};
  const write = (value: unknown) => writeFileSync(join(agentDir,'memory.json'),JSON.stringify(value));
  return {cwd,agentDir,config,write};
}
test('configuración optativa, scope exacto y no configuración ejecutable desde el workspace',t=>{
  const f=fixture(t);
  assert.equal(readMemoryConfig(f.cwd,f.agentDir),undefined);
  f.write({workspaces:{[f.cwd]:f.config}});
  assert.equal(readMemoryConfig(f.cwd,f.agentDir)?.project,'fixture');
  const other=join(f.cwd,'other');mkdirSync(other);
  assert.equal(readMemoryConfig(other,f.agentDir),undefined);
  f.write({workspaces:{[f.cwd]:{...f.config,command:'ytk-memory'}}});
  assert.throws(()=>readMemoryConfig(f.cwd,f.agentDir),/inválida/);
  f.write({workspaces:{[f.cwd]:{...f.config,args:['other']}}});
  assert.throws(()=>readMemoryConfig(f.cwd,f.agentDir),/inválida/);
});
test('adaptador valida proyecto, área, estado, ID y presupuesto',async()=>{
  const cfg={project:'fixture',area:'dev'};
  const p=createYtkProvider(cfg,async()=>({entries:[{...entry,content:'a'.repeat(8000)}]}),noop,noop);
  assert.equal((await p.list())[0].content.length,4795);
  for(const bad of [{...entry,projectId:'other'},{...entry,area:'other'},{...entry,status:'archived'},{...entry,expiresAt:'2000-01-01T00:00:00Z'}]){
    const q=createYtkProvider(cfg,async()=>({entries:[bad]}),noop,noop);
    await assert.rejects(q.list(),/Memoria/);
  }
  const q=createYtkProvider(cfg,async()=>({entry}),noop,noop);
  await assert.rejects(q.get('wrong'),/ID/);
});
test('sesión y escritura explícitas, ID exacto y cierre en la misma conexión',async()=>{
  const calls:string[]=[];
  const p=createYtkProvider({project:'fixture'},async(name,args)=>{
    calls.push(name);
    if(name==='memory_session_start')return {sessionId:'s1',entries:[entry]};
    if(name==='memory_save'){assert.equal(args.sessionId,'s1');assert.equal(args.subjectKey,'task:1');return {stored:true,entryId:'m1'};}
    if(name==='memory_session_finish')return {sessionId:'s1',summaryStored:true};
    assert.fail('unexpected');
  },noop,async()=>{calls.push('close');},true);
  await assert.rejects(p.save('s1',draft),/Sesión/);
  assert.equal((await p.start()).id,'s1');
  await assert.rejects(p.start(),/Ya existe/);
  await assert.rejects(p.save('other',draft),/Sesión/);
  assert.equal(await p.save('s1',draft),'m1');
  await p.finish('s1','handoff');
  await p.close();await p.close();
  assert.deepEqual(calls,['memory_session_start','memory_save','memory_session_finish','close']);
  const readOnly=createYtkProvider({project:'fixture'},async()=>assert.fail('unexpected'),noop,noop);
  await assert.rejects(readOnly.start(),/no habilitada/);
});
test('CLI deshabilitado, no TTY, rechazo y cierre ante error',async t=>{
  const f=fixture(t);
  const opts={cwd:f.cwd,agentDir:f.agentDir,interactive:true,approve:async()=>true,connect:async(_cfg:MemoryConfig)=>{assert.fail('no iniciar');}};
  assert.deepEqual(await runMemoryCommand({kind:'status'},opts),{status:'disabled'});
  f.write({workspaces:{[f.cwd]:f.config}});
  await assert.rejects(runMemoryCommand({kind:'list'},{...opts,interactive:false}),/terminal interactiva/);
  await assert.rejects(runMemoryCommand({kind:'list'},{...opts,approve:async()=>false}),/no autorizado/);
  let closed=false;
  await assert.rejects(runMemoryCommand({kind:'list'},{...opts,connect:async()=>createYtkProvider({project:'fixture'},async()=>{throw Error('fixture');},noop,async()=>{closed=true;})}),/fixture/);
  assert.equal(closed,true);
  assert.throws(()=>parseMemoryCommand(['save','secret']));
});
test('transporte MCP stdio real con fixture compatible con respuestas de YTK',async t=>{
  const f=fixture(t);
  writeFileSync(join(f.cwd,'mcp'),[
    "const readline=require('node:readline');",
    "const tools=['memory_list','memory_search','memory_get','memory_session_start','memory_save','memory_session_finish'];",
    "const entry="+JSON.stringify(entry)+";",
    "const rl=readline.createInterface({input:process.stdin});",
    "rl.on('line',line=>{const m=JSON.parse(line); if(m.id===undefined)return; let result;",
    "if(m.method==='initialize')result={protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};",
    "else if(m.method==='tools/list')result={tools:tools.map(name=>({name,inputSchema:{type:'object'}}))};",
    "else if(m.method==='tools/call'){const n=m.params.name;let data=n==='memory_get'?{entry}:n==='memory_session_start'?{sessionId:'s1',entries:[entry]}:n==='memory_save'?{stored:true,entryId:'m1'}:n==='memory_session_finish'?{sessionId:'s1',summaryStored:true}:{entries:[entry]};result={content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};}",
    "else result={};process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n');});"
  ].join('\n'));
  const p=await connectYtk({...f.config,cwd:f.cwd},undefined,true);
  try{
    assert.equal((await p.list())[0].id,'m1');
    assert.equal((await p.get('m1')).content,'Evidence');
    const s=await p.start();
    assert.equal(await p.save(s.id,draft),'m1');
    await p.finish(s.id,'handoff');
  }finally{await p.close();}
});
