import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approveContext, collectContext, parsePlanningArgs } from '../src/context-engine.ts';

function fixture(t: { after: (fn: () => void) => void }) {
  const cwd = mkdtempSync(join(tmpdir(), 'your-gear-context-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, 'src'));
  writeFileSync(join(cwd, 'README.md'), 'project docs');
  writeFileSync(join(cwd, 'src', 'retry.ts'), 'retry code');
  writeFileSync(join(cwd, 'src', 'unrelated.ts'), 'unrelated');
  return cwd;
}

test('solo archivos seleccionados y metadatos raíz, sin recorrido recursivo', t => {
  const cwd = fixture(t);
  const context = collectContext(cwd, ['src/retry.ts', 'README.md']);
  assert.deepEqual(context.entries.map(x => x.path), ['src/retry.ts', 'README.md']);
  assert.equal(context.bytes, Buffer.byteLength(JSON.stringify(context.entries)));
  assert.equal(context.digest.length, 64);
  assert.deepEqual(collectContext(cwd, ['src/retry.ts', 'README.md']), context);
});

test('rechaza rutas externas, protegidas, binarios, archivos grandes y directorios', t => {
  const cwd = fixture(t);
  writeFileSync(join(cwd, '.env'), 'secret');
  writeFileSync(join(cwd, 'credentials.json'), 'secret');
  writeFileSync(join(cwd, 'image.png'), 'binary');
  writeFileSync(join(cwd, 'binary.ts'), Buffer.from([0, 1, 2]));
  writeFileSync(join(cwd, 'large.ts'), 'a'.repeat(8001));
  mkdirSync(join(cwd, 'directory.ts'));
  for (const path of ['../outside.ts', join(cwd, 'README.md'), '.env', 'credentials.json', 'image.png', 'binary.ts', 'large.ts', 'directory.ts', 'missing.ts']) {
    assert.throws(() => collectContext(cwd, [path]), /archivo de contexto explícito/);
  }
});

test('rechaza hardlinks y directorios enlazados, incluso dentro del workspace', t => {
  const cwd = fixture(t);
  linkSync(join(cwd, 'README.md'), join(cwd, 'linked.md'));
  assert.throws(() => collectContext(cwd, ['linked.md']), /archivo de contexto explícito/);
  symlinkSync(join(cwd, 'src'), join(cwd, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => collectContext(cwd, ['alias/retry.ts']), /archivo de contexto explícito/);
});

test('presupuesto cuenta bytes JSON y no omite selecciones explícitas en silencio', t => {
  const cwd = fixture(t);
  const paths = Array.from({ length: 4 }, (_, i) => 'src/f' + i + '.ts');
  for (const path of paths) writeFileSync(join(cwd, path), 'x'.repeat(7000));
  assert.throws(() => collectContext(cwd, paths), /archivo de contexto explícito/);
  assert.ok(collectContext(cwd, paths.slice(0, 3)).bytes <= 24000);
  assert.throws(() => collectContext(cwd, Array(9).fill('README.md')), /hasta 8/);
});

test('el usuario revisa contenido exacto antes de enviarlo, rechazo no autoriza', async t => {
  const cwd = fixture(t);
  writeFileSync(join(cwd, 'README.md'), 'text\u001b[2J\u009b');
  const context = collectContext(cwd);
  assert.equal(await approveContext(context, async preview => {
    assert.match(preview, /README.md/);
    assert.match(preview, /\\u001b/);
    assert.match(preview, /\\u009b/);
    assert.equal(preview.includes('\u001b'), false);
    return 'n';
  }), false);
  assert.equal(await approveContext(context, async () => 's'), true);
  await assert.rejects(approveContext(context, async () => { context.entries[0].content = 'changed'; return 's'; }), /contexto cambió/);
});

test('cancelación antes o durante la revisión bloquea envío', async t => {
  const cwd = fixture(t);
  const context = collectContext(cwd);
  const controller = new AbortController();
  await assert.rejects(approveContext(context, async () => { controller.abort(); return 's'; }, controller.signal), /cancelada/);
  assert.throws(() => collectContext(cwd, [], controller.signal), /cancelada/);
});

test('flags de contexto repetibles antes de la solicitud', () => {
  assert.deepEqual(parsePlanningArgs(['--context', 'src/a.ts', '--context', 'README.md', 'task']), { files: ['src/a.ts', 'README.md'], promptArgs: ['task'] });
  assert.throws(() => parsePlanningArgs(['--context']), /hasta 8/);
});
