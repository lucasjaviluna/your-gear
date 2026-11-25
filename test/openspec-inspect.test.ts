import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, linkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectOpenSpec } from '../src/openspec-inspect.ts';

test('inspección solo usa salida validada y requiere autorización', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gear-test-spec-'));
  try {
    mkdirSync(join(dir, 'openspec', 'changes', 'demo'), {recursive:true});
    writeFileSync(join(dir, 'openspec', 'config.yaml'), 'schema: spec-driven\n');
    const script = join(dir, 'fake.js');
    writeFileSync(script, `const a=process.argv.slice(2), root={path:process.cwd(),source:'nearest'}; if(a[0]==='--version') console.log('2.2.0'); else if(a[0]==='status') console.log(JSON.stringify({root,changeName:'demo',isPlanningComplete:true,artifacts:[{id:'proposal',status:'done'}]})); else console.log(JSON.stringify({root,version:'1.0',items:[{id:'demo',type:'change',valid:true}]}));`);
    const opts = {cwd:dir, script, change:'demo', interactive:true, approve:async()=>true};
    await assert.rejects(inspectOpenSpec({...opts, approve:async()=>false}), /no autorizada/);
    await assert.rejects(inspectOpenSpec({...opts, interactive:false}), /terminal interactiva/);
    const result = await inspectOpenSpec(opts) as {planningComplete:boolean; structurallyValid:boolean};
    assert.equal(result.planningComplete, true);
    assert.equal(result.structurallyValid, true);
    await assert.rejects(inspectOpenSpec({...opts, approve:async()=>{ writeFileSync(script, 'changed'); return true; }}), /modificados/);
    writeFileSync(script, `console.log('2.1.0')`);
    await assert.rejects(inspectOpenSpec(opts), /2\.2\.0/);
    writeFileSync(script, `const a=process.argv.slice(2); if(a[0]==='--version') console.log('2.2.0'); else console.log(JSON.stringify({root:{path:require('node:os').tmpdir(),source:'nearest'},changeName:'demo',isPlanningComplete:true,artifacts:[]}));`);
    await assert.rejects(inspectOpenSpec(opts), /raíz/);
    await assert.rejects(inspectOpenSpec({...opts, approve:async()=>{writeFileSync(join(dir,'openspec','changes','demo','new.md'),'changed'); return true;}}), /modificados/);
    writeFileSync(script, `console.log(process.argv[2]==='--version'?'2.2.0':'{}')`);
    await assert.rejects(inspectOpenSpec(opts), /respuesta|raíz/i);
    writeFileSync(script, `if(process.argv[2]==='--version') console.log('2.2.0'); else console.log('x'.repeat(100000));`);
    await assert.rejects(inspectOpenSpec(opts), /límite/);
    writeFileSync(script, `if(process.argv[2]==='--version') console.log('2.2.0'); else setTimeout(()=>{}, 30000);`);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 500);
    try { await assert.rejects(inspectOpenSpec({...opts, signal:abort.signal}), /cancelad/); } finally { clearTimeout(timer); }
    await assert.rejects(inspectOpenSpec(opts), /límite/);
    writeFileSync(join(dir, 'openspec', 'config.yaml'), 'schema: spec-driven\nstore: externo\n');
    await assert.rejects(inspectOpenSpec(opts), /config.yaml/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('cancela antes de iniciar y rechaza enlaces en el árbol', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gear-test-spec-'));
  try {
    mkdirSync(join(dir, 'openspec', 'changes', 'demo'), {recursive:true});
    writeFileSync(join(dir, 'openspec', 'config.yaml'), 'schema: spec-driven\n');
    const script = join(dir, 'fake.js'); writeFileSync(script, '');
    const controller = new AbortController(); controller.abort();
    await assert.rejects(inspectOpenSpec({cwd:dir,script,change:'demo',interactive:true,approve:async()=>true,signal:controller.signal}), /cancelada/);
    const outside = join(dir, 'outside'); writeFileSync(outside, 'x');
    const linked = join(dir, 'openspec', 'changes', 'demo', 'linked'); linkSync(outside, linked);
    await assert.rejects(inspectOpenSpec({cwd:dir,script,change:'demo',interactive:true,approve:async()=>true}), /enlaces/);
    unlinkSync(linked);
    if (process.platform !== 'win32') {
      symlinkSync(dir, join(dir, 'openspec', 'link'));
      await assert.rejects(inspectOpenSpec({cwd:dir,script,change:'demo',interactive:true,approve:async()=>true}), /enlaces/);
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
