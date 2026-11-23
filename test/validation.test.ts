import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createToolCallHandler } from '../src/gate.ts';

test('gate rechaza read, write y edit fuera del workspace aun con aprobación', async t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-boundary-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'workspace');
  const { mkdirSync } = await import('node:fs');
  mkdirSync(cwd);
  const outside = join(root, 'outside.txt');
  writeFileSync(outside, 'original');
  let approvals = 0;
  const handler = createToolCallHandler(cwd, async () => { approvals++; return true; });
  for (const path of [outside, relative(cwd, outside)]) {
    for (const toolName of ['read', 'write', 'edit']) {
      const result = await handler({ toolName, input: { path, content: 'changed', oldText: 'original', newText: 'changed' } });
      assert.equal(result?.block, true, `${toolName}: ${path}`);
    }
  }
  assert.equal(approvals, 0);
  assert.equal(readFileSync(outside, 'utf8'), 'original');
});

test('gate rechaza escritura con stdin y stdout sin TTY', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'your-gear-no-tty-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'non-tty-approval.ts');
  const result = execFileSync(process.execPath, [fixture, cwd], { input: 's\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  assert.equal(result, 'blocked');
  assert.equal(existsSync(join(cwd, 'created.txt')), false);
});
