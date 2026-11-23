import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createSessionManager, parseSessionArgs } from '../src/sessions.ts';

test('las opciones de sesión son explícitas y no alteran el prompt normal', () => {
  assert.deepEqual(parseSessionArgs(['hola']), { mode: 'memory', promptArgs: ['hola'] });
  assert.deepEqual(parseSessionArgs(['--persist', 'hola']), { mode: 'persist', promptArgs: ['hola'] });
  assert.deepEqual(parseSessionArgs(['--continue', 'hola']), { mode: 'continue', promptArgs: ['hola'] });
  assert.throws(() => parseSessionArgs(['--persist', '--continue', 'hola']), /solo una/);
  assert.throws(() => parseSessionArgs(['--persiste', 'hola']), /Opción desconocida: --persiste/);
  assert.throws(() => parseSessionArgs(['--persist', '--persiste', 'hola']), /Opción desconocida: --persiste/);
  assert.deepEqual(parseSessionArgs(['--', '--persiste']), { mode: 'memory', promptArgs: ['--persiste'] });
  assert.deepEqual(parseSessionArgs(['hola', '--persiste']), { mode: 'memory', promptArgs: ['hola', '--persiste'] });
});

test('una sesión dañada no se reanuda ni se modifica', async t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-corrupt-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'workspace');
  mkdirSync(cwd);
  const agentDir = join(root, 'agent');
  const session = await createSessionManager(cwd, agentDir, 'persist');
  session.appendMessage({ role: 'user', content: 'prueba', timestamp: Date.now() });
  const path = session.getSessionFile()!;
  const damaged = readFileSync(path, 'utf8') + '{"type":\n';
  writeFileSync(path, damaged);
  await assert.rejects(createSessionManager(cwd, agentDir, 'continue'), /sesión más reciente está dañada/);
  assert.equal(readFileSync(path, 'utf8'), damaged);
});

test('un directorio de sesiones inaccesible se informa como error', async t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-inaccessible-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'workspace');
  mkdirSync(cwd);
  const agentDir = join(root, 'agent');
  mkdirSync(agentDir);
  writeFileSync(join(agentDir, 'sessions'), 'no es un directorio');
  await assert.rejects(createSessionManager(cwd, agentDir, 'continue'), /No se pudo acceder al directorio/);
});

test('Pi persiste y reanuda mensajes, aislados por workspace', async t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-sessions-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const first = join(root, 'first');
  const second = join(root, 'second');
  const agentDir = join(root, 'agent');
  mkdirSync(first);
  mkdirSync(second);

  await assert.rejects(createSessionManager(first, agentDir, 'continue'), /No hay una sesión/);
  assert.equal(existsSync(agentDir), false);
  const memory = await createSessionManager(first, agentDir, 'memory');
  memory.appendMessage({ role: 'user', content: 'privado en memoria', timestamp: Date.now() });
  assert.equal(existsSync(agentDir), false);

  const initial = await createSessionManager(first, agentDir, 'persist');
  initial.appendMessage({ role: 'user', content: 'mensaje de prueba', timestamp: Date.now() });
  assert.equal(existsSync(initial.getSessionFile()!), true);
  const resumed = await createSessionManager(first, agentDir, 'continue');
  assert.equal(resumed.getSessionId(), initial.getSessionId());
  const message = resumed.buildSessionContext().messages[0];
  assert.equal(message?.role, 'user');
  if (message?.role !== 'user') throw new Error('Falta el mensaje guardado');
  assert.equal(message.content, 'mensaje de prueba');
  await assert.rejects(createSessionManager(second, agentDir, 'continue'), /No hay una sesión/);
});

test('reanuda la sesión más reciente y no usa una anterior si la reciente está dañada', async t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-recent-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'workspace');
  mkdirSync(cwd);
  const agentDir = join(root, 'agent');
  const first = await createSessionManager(cwd, agentDir, 'persist');
  first.appendMessage({ role: 'user', content: 'primera', timestamp: Date.now() });
  const second = await createSessionManager(cwd, agentDir, 'persist');
  second.appendMessage({ role: 'user', content: 'segunda', timestamp: Date.now() });
  const older = new Date(Date.now() - 60_000);
  utimesSync(first.getSessionFile()!, older, older);
  assert.equal((await createSessionManager(cwd, agentDir, 'continue')).getSessionId(), second.getSessionId());
  const path = second.getSessionFile()!;
  writeFileSync(path, 'contenido dañado\n');
  await assert.rejects(createSessionManager(cwd, agentDir, 'continue'), /sesión más reciente está dañada/);
  assert.equal(readFileSync(path, 'utf8'), 'contenido dañado\n');
});

test('rechaza una sesión cuyo encabezado indica otro workspace', async t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-foreign-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const first = join(root, 'first');
  const second = join(root, 'second');
  mkdirSync(first);
  mkdirSync(second);
  const agentDir = join(root, 'agent');
  const session = await createSessionManager(first, agentDir, 'persist');
  session.appendMessage({ role: 'user', content: 'privado', timestamp: Date.now() });
  const path = session.getSessionFile()!;
  const lines = readFileSync(path, 'utf8').split('\n');
  const header = JSON.parse(lines[0]);
  header.cwd = second;
  lines[0] = JSON.stringify(header);
  const changed = lines.join('\n');
  writeFileSync(path, changed);
  await assert.rejects(createSessionManager(first, agentDir, 'continue'), /no corresponde a este workspace/);
  assert.equal(readFileSync(path, 'utf8'), changed);
});
