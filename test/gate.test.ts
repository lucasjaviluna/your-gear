import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createToolCallHandler } from '../src/gate.ts';

function workspace(t: { after: (callback: () => void) => void }) {
  const cwd = mkdtempSync(join(tmpdir(), 'your-gear-gate-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}

test('gate bloquea efectos antes de invocar execute', async t => {
  const cwd = workspace(t);
  const handler = createToolCallHandler(cwd, async () => false);
  let executions = 0;
  async function fakeExecute(event: { toolName: string; input: unknown }) {
    const result = await handler(event);
    if (result?.block) return false;
    executions++;
    return true;
  }
  assert.equal(await fakeExecute({ toolName: 'write', input: { path: 'write.txt' } }), false);
  assert.equal(await fakeExecute({ toolName: 'bash', input: { command: 'echo hello' } }), false);
  assert.equal(await fakeExecute({ toolName: 'custom_plugin', input: {} }), false);
  assert.equal(executions, 0);
});

test('gate permite lectura y nunca solicita confirmación', async t => {
  const cwd = workspace(t);
  writeFileSync(join(cwd, 'safe.txt'), 'safe');
  let calls = 0;
  const handler = createToolCallHandler(cwd, async () => { calls++; return false; });
  assert.equal(await handler({ toolName: 'read', input: { path: 'safe.txt' } }), undefined);
  assert.equal(calls, 0);
});

test('gate permite write únicamente con aprobación explícita', async t => {
  const cwd = workspace(t);
  let prompt = '';
  const handler = createToolCallHandler(cwd, async (description) => { prompt = description; return true; });
  assert.equal(await handler({ toolName: 'write', input: { path: 'demo.txt' } }), undefined);
  assert.match(prompt, /write: /);
});
