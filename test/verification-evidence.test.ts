import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTaskArgs, runSelectedTest } from '../src/verification-evidence.ts';

function fixture(t: { after: (fn: () => void) => void }) {
  const cwd = mkdtempSync(join(tmpdir(), 'gear-verify-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}
test('selección explícita de pruebas sin shell, glob ni flags arbitrarios', () => {
  assert.deepEqual(parseTaskArgs(['--context','a.ts','--verify-test','a.test.mjs','hola']),
    { files: ['a.ts'], tests: ['a.test.mjs'], promptArgs: ['hola'] });
  for (const args of [['--verify-test','*.test.js'], ['--verify-test','--inspect'], ['--verify-test','script.sh'], ['--verify-test','a.test.js','--verify-test','a.test.js']]) {
    assert.throws(() => parseTaskArgs(args));
  }
});
test('runner ejecuta tests reales y distingue código de salida cero de fallo', async t => {
  const cwd = fixture(t);
  writeFileSync(join(cwd, 'ok.test.cjs'), "const t = require('node:test'); t('real pass', () => {});");
  writeFileSync(join(cwd, 'bad.test.cjs'), "const t = require('node:test'); t('real fail', () => { throw new Error('fixture failure'); });");
  const ok = await runSelectedTest(cwd, 'ok.test.cjs', async preview => {
    assert.match(preview, /node:test/);
    return 's';
  });
  assert.equal(ok.status, 'exit-zero');
  assert.equal(ok.exitCode, 0);
  assert.match(ok.stdout, /real pass/);
  const bad = await runSelectedTest(cwd, 'bad.test.cjs', async () => 's');
  assert.equal(bad.status, 'failed');
  assert.notEqual(bad.exitCode, 0);
  assert.match(bad.stdout, /fixture failure/);
});
test('rechazo y archivo modificado durante aprobación no ejecutan código', async t => {
  const cwd = fixture(t);
  const path = join(cwd, 'effect.test.cjs');
  const marker = join(cwd, 'marker.txt');
  writeFileSync(path, "require('node:fs').writeFileSync(" + JSON.stringify(marker) + ", 'effect')");
  assert.equal((await runSelectedTest(cwd, 'effect.test.cjs', async () => 'n')).status, 'skipped');
  assert.equal(existsSync(marker), false);
  assert.equal((await runSelectedTest(cwd, 'effect.test.cjs', async () => {
    writeFileSync(path, 'changed'); return 's';
  })).status, 'stale');
  assert.equal(existsSync(marker), false);
  assert.equal((await runSelectedTest(cwd, '../outside.test.cjs', async () => { assert.fail('no ask'); })).status, 'error');
});
test('cancelación antes de inicio impide ejecutar prueba', async t => {
  const cwd = fixture(t);
  writeFileSync(join(cwd, 'a.test.cjs'), '');
  const c = new AbortController();
  await assert.rejects(runSelectedTest(cwd, 'a.test.cjs', async () => { c.abort(); return 's'; }, c.signal), /cancelada/);
});
