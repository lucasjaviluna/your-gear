import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reviewOpenSpec } from '../src/openspec-review.ts';

test('revisión exige artefactos explícitos, validación y contenido vigente', async () => {
  const cwd=mkdtempSync(join(tmpdir(),'gear-sdd-'));
  try {
    const base='openspec/changes/demo/';
    mkdirSync(join(cwd,base,'specs/greeting'),{recursive:true});
    writeFileSync(join(cwd,'openspec/config.yaml'),'schema: spec-driven\n');
    const files=['proposal.md','design.md','tasks.md','specs/greeting/spec.md'].map(x=>base+x);
    for (const file of files) writeFileSync(join(cwd,file),'contenido');
    const script=join(cwd,'fake.js');
    writeFileSync(script,`const a=process.argv.slice(2),root={path:process.cwd(),source:'nearest'}; if(a[0]==='--version') console.log('2.2.0'); else if(a[0]==='status') console.log(JSON.stringify({root,changeName:'demo',isPlanningComplete:true,artifacts:[]})); else console.log(JSON.stringify({root,version:'1.0',items:[{id:'demo',type:'change',valid:true}]}));`);
    const options={cwd,script,change:'demo',files,interactive:true,approve:async()=>true,ask:async()=> 's'};
    await assert.rejects(reviewOpenSpec({...options,files:files.slice(0,3)}),/Seleccioná/);
    assert.equal((await reviewOpenSpec({...options,ask:async()=> 'n'})).status,'cancelled');
    const result=await reviewOpenSpec(options);
    assert.equal(result.status,'reviewed');
    assert.ok(result.context?.entries.some(e=>e.path===files[0]));
    await assert.rejects(reviewOpenSpec({...options,ask:async()=>{writeFileSync(join(cwd,files[0]),'cambiado'); return 's';}}),/cambiaron/);
  } finally {rmSync(cwd,{recursive:true,force:true});}
});
