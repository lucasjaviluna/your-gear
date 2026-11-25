import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverOpenSpec, parseSddCommand, parseReportedVersion, probeOpenSpec } from '../src/openspec.ts';

function fixture(t:{after:(fn:()=>void)=>void}) {
  const cwd=realpathSync(mkdtempSync(join(tmpdir(),'gear-sdd-')));
  t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  return cwd;
}

test('inventario local: no asciende a padres, no interpreta config ni instala nada',t=>{
  const cwd=fixture(t), root=join(cwd,'openspec'),child=join(cwd,'nested');
  assert.equal(discoverOpenSpec(cwd).root,'missing');
  mkdirSync(join(root,'changes','add-retry'),{recursive:true});mkdirSync(child);
  writeFileSync(join(root,'config.yaml'),'store: external\ninvalid yaml: [');
  writeFileSync(join(root,'changes','add-retry','proposal.md'),'UNTRUSTED');
  mkdirSync(join(root,'changes','archive'));
  mkdirSync(join(root,'changes','Bad Name'));
  writeFileSync(join(root,'changes','not-a-change'),'file');
  const result=discoverOpenSpec(cwd);
  assert.equal(result.root,'present');
  assert.equal(result.config,'present');
  assert.equal(result.specs,'missing');
  assert.deepEqual(result.candidates,[{id:'add-retry',proposal:'present',design:'missing',tasks:'missing',metadata:'missing',specs:'missing'}]);
  assert.equal(result.ignoredEntries,2);
  assert.equal(result.ready,false);
  assert.equal(result.cli,'not-probed');
  assert.equal(discoverOpenSpec(child).root,'missing');
  assert.ok(!JSON.stringify(result).includes('UNTRUSTED'));
  assert.ok(!JSON.stringify(result).includes('external'));
});

test('no sigue enlaces observados a root o changes, ni abre marcadores especiales',t=>{
  const cwd=fixture(t),outside=join(cwd,'other'),root=join(cwd,'openspec');
  mkdirSync(join(outside,'changes','external'),{recursive:true});
  symlinkSync(outside,root,process.platform==='win32'?'junction':'dir');
  assert.equal(discoverOpenSpec(cwd).root,'unsafe');
  assert.deepEqual(discoverOpenSpec(cwd).candidates,[]);
  rmSync(root,{recursive:true,force:true});mkdirSync(root);
  symlinkSync(join(outside,'changes'),join(root,'changes'),process.platform==='win32'?'junction':'dir');
  assert.equal(discoverOpenSpec(cwd).changes,'unsafe');
  assert.deepEqual(discoverOpenSpec(cwd).candidates,[]);
});

test('inventario acotado y cancelable',t=>{
  const cwd=fixture(t), changes=join(cwd,'openspec','changes');
  mkdirSync(changes,{recursive:true});
  for(let i=0;i<25;i++)mkdirSync(join(changes,'change-'+i));
  const result=discoverOpenSpec(cwd);
  assert.equal(result.candidates.length,20);
  assert.equal(result.scanLimited,true);
  const controller=new AbortController();controller.abort();
  assert.throws(()=>discoverOpenSpec(cwd,controller.signal));
});

test('comandos cerrados: no admite args arbitrarios, mutaciones ni PATH implícito',()=>{
  assert.deepEqual(parseSddCommand(['status']),{kind:'status'});
  assert.deepEqual(parseSddCommand(['probe',process.execPath]),{kind:'probe',path:process.execPath});
  for(const args of [['apply'],['status','--store','foo'],['probe','openspec'],['probe',process.execPath,'--help'],['probe','../bin']])
    assert.throws(()=>parseSddCommand(args),/Uso/);
  assert.equal(parseReportedVersion('v2.2.0\n'),'2.2.0');
  assert.equal(parseReportedVersion('1.4.1'),'1.4.1');
  assert.equal(parseReportedVersion('2.2.0-rc.1'),'2.2.0-rc.1');
  for(const s of ['version 2.2.0','2.2.0\nextra','', '2.2.0; echo nope'])
    assert.throws(()=>parseReportedVersion(s),/versión/);
});

test('probe rechaza sin TTY, rechazo humano, cambio del ejecutable y cancelación',async t=>{
  const cwd=fixture(t),signal=new AbortController().signal;
  const options={cwd,signal,interactive:true,approve:async(_description:string)=>false};
  await assert.rejects(probeOpenSpec(process.execPath,{...options,interactive:false,approve:async()=>assert.fail('no prompt')}),/terminal interactiva/);
  await assert.rejects(probeOpenSpec(process.execPath,options),/no autorizado/);
  const fake=join(cwd,'fake.exe');writeFileSync(fake,'fixture');
  await assert.rejects(probeOpenSpec(fake,{...options,approve:async()=>{writeFileSync(fake,'changed fixture');return true;}}),/cambió/);
  const controller=new AbortController();
  await assert.rejects(probeOpenSpec(process.execPath,{...options,signal:controller.signal,approve:async()=>{controller.abort();return true;}}));
});

test('probe ejecuta un proceso real con argumento fijo, pero no certifica identidad ni compatibilidad',async t=>{
  const cwd=fixture(t);
  // Node is a deterministic cross-platform test binary; not OpenSpec.
  const result=await probeOpenSpec(process.execPath,{cwd,signal:new AbortController().signal,interactive:true,
    approve:async description=>{assert.match(description,/--version/);assert.match(description,/no sandbox/);return true;}});
  assert.deepEqual(result,{status:'reported',version:process.versions.node,compatibility:'not-validated'});
});
