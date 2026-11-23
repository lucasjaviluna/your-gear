import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { authorizeTool, decideTool } from '../src/policy.ts';

function workspace(t: { after: (callback: () => void) => void }): string {
  const cwd = mkdtempSync(join(tmpdir(), 'your-gear-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  writeFileSync(join(cwd, 'hello.txt'), 'hola');
  return cwd;
}

test('read dentro de workspace está permitido', t => {
  const cwd = workspace(t);
  assert.equal(decideTool({ cwd, toolName: 'read', input: { path: 'hello.txt' } }).type, 'allow');
});

test('path traversal y ruta absoluta externa se deniegan', t => {
  const cwd = workspace(t);
  for (const path of ['../secrets.txt', resolve(cwd, '..', 'outside')]) {
    assert.equal(decideTool({ cwd, toolName: 'read', input: { path } }).type, 'deny');
  }
});

test('se deniegan secretos y directorios internos', t => {
  const cwd = workspace(t);
  for (const path of ['.env', '.env.local', '.git/config', '.your-gear/auth.json']) {
    assert.equal(decideTool({ cwd, toolName: 'read', input: { path } }).type, 'deny');
  }
});

test('symlink fuera de workspace se deniega', t => {
  const cwd = workspace(t);
  symlinkSync(tmpdir(), join(cwd, 'external'), 'dir');
  assert.equal(decideTool({ cwd, toolName: 'read', input: { path: 'external/something' } }).type, 'deny');
});

test('escritura y bash requieren aprobación', t => {
  const cwd = workspace(t);
  for (const [toolName, input] of [
    ['write', { path: 'new.txt', content: 'x' }],
    ['edit', { path: 'hello.txt', oldText: 'hola', newText: 'chau' }],
    ['bash', { command: 'echo OK' }],
  ] as const) {
    assert.equal(decideTool({ cwd, toolName, input }).type, 'ask');
  }
});

test('desconocidas y argumentos inválidos se deniegan', t => {
  const cwd = workspace(t);
  assert.equal(decideTool({ cwd, toolName: 'custom_tool', input: {} }).type, 'deny');
  assert.equal(decideTool({ cwd, toolName: 'bash', input: { command: '' } }).type, 'deny');
  assert.equal(decideTool({ cwd, toolName: 'read', input: { path: 15 } }).type, 'deny');
});

test('rechazo, ausencia de UI y error bloquean antes de ejecutar', async t => {
  const cwd = workspace(t);
  const req = { cwd, toolName: 'write', input: { path: 'test.txt' } };
  assert.equal((await authorizeTool(req, async () => false))?.block, true);
  assert.equal((await authorizeTool(req, async () => { throw new Error('no ui'); }))?.block, true);
  assert.equal(await authorizeTool(req, async () => true), undefined);
});

test('lectura permitida no solicita aprobación', async t => {
  const cwd = workspace(t);
  let requested = false;
  const result = await authorizeTool({ cwd, toolName: 'read', input: { path: 'hello.txt' } }, async () => {requested = true; return false;});
  assert.equal(result, undefined);
  assert.equal(requested, false);
});

test('escritura debajo de symlink externo se deniega', t => {
  const cwd = workspace(t);
  mkdirSync(join(cwd, 'inside'));
  symlinkSync(tmpdir(), join(cwd, 'link'), 'dir');
  assert.equal(decideTool({ cwd, toolName: 'write', input: { path: 'link/new.txt' } }).type, 'deny');
});

test('archivos adicionales de credenciales se deniegan', t => {
  const cwd = workspace(t);
  for (const path of ['.npmrc', '.netrc', '.aws/credentials', '.pypirc', '.config/token', '.ENV.LOCAL']) {
    assert.equal(decideTool({ cwd, toolName: 'read', input: { path } }).type, 'deny');
  }
});

test('comandos muestran argumentos completos sin caracteres de control', t => {
  const cwd = workspace(t);
  const result = decideTool({ cwd, toolName: 'bash', input: { command: 'echo ok\x1b[31m\nrm foo' } });
  assert.equal(result.type, 'ask');
  assert.equal(result.reason.includes('\x1b'), false);
  assert.match(result.reason, /\\u001b/);
  assert.match(result.reason, /rm foo/);
});

test('symlink interno a archivo protegido se deniega', t => {
  const cwd = workspace(t);
  writeFileSync(join(cwd, '.env'), 'secret=1');
  symlinkSync(join(cwd, '.env'), join(cwd, 'alias'));
  assert.equal(decideTool({ cwd, toolName: 'read', input: { path: 'alias' } }).type, 'deny');
});
