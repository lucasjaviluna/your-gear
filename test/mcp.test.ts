import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approveMcpStart, mcpToolNames, readMcpServer, waitForMcpTools } from '../src/mcp.ts';
import { createToolCallHandler } from '../src/gate.ts';
import { parseSessionArgs } from '../src/sessions.ts';

test('MCP requiere selección explícita y registro de usuario válido', t => {
  const dir = mkdtempSync(join(tmpdir(), 'your-gear-mcp-config-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'mcp.json');
  assert.equal(parseSessionArgs(['hola']).mcpName, undefined);
  assert.equal(parseSessionArgs(['--mcp', 'fixture', 'hola']).mcpName, 'fixture');
  assert.throws(() => parseSessionArgs(['--mcp']), /servidor/);
  assert.throws(() => parseSessionArgs(['--mcp', 'a', '--mcp', 'b']), /solo/);
  assert.throws(() => readMcpServer(dir, 'fixture'), /configuración/);
  const server = { command: process.execPath, args: ['fixture.js'], tools: ['effect'] };
  writeFileSync(path, JSON.stringify({ fixture: server }));
  assert.deepEqual(readMcpServer(dir, 'fixture'), { name: 'fixture', ...server });
  assert.deepEqual(mcpToolNames(readMcpServer(dir, 'fixture')), ['mcp__fixture__effect']);
  assert.throws(() => readMcpServer(dir, 'other'), /registrado/);
  assert.throws(() => readMcpServer(dir, 'fixture__other'), /inválido/);
  for (const invalid of [{ ...server, command: 'node' }, { ...server, tools: [] },
    { ...server, tools: ['effect', 'effect'] }, { ...server, tools: ['effect__other'] },
    { ...server, args: [42] }, { ...server, env: { SECRET: 'no' } }]) {
    writeFileSync(path, JSON.stringify({ fixture: invalid }));
    assert.throws(() => readMcpServer(dir, 'fixture'), /inválida/);
  }
});

test('inicio MCP exige aprobación; herramientas exactas pasan por el gate', async () => {
  const server = { name: 'fixture', command: process.execPath, args: ['fixture.js'], tools: ['effect'] };
  let descriptions: string[] = [];
  await assert.rejects(approveMcpStart(server, process.cwd(), async text => { descriptions.push(text); return false; }), /no autorizado/);
  assert.match(descriptions[0], /fixture\.js/);
  await approveMcpStart(server, process.cwd(), async () => true);
  const call = { toolName: 'mcp__fixture__effect', input: {} };
  const noMcp = createToolCallHandler(process.cwd(), async () => { throw new Error('no approval expected'); });
  assert.equal((await noMcp(call))?.block, true);
  const deny = createToolCallHandler(process.cwd(), async () => false, mcpToolNames(server));
  assert.equal((await deny(call))?.block, true);
  const allow = createToolCallHandler(process.cwd(), async text => { descriptions.push(text); return true; }, mcpToolNames(server));
  assert.equal(await allow(call), undefined);
  assert.match(descriptions.at(-1)!, /mcp__fixture__effect/);
  assert.equal((await allow({ ...call, toolName: 'mcp__fixture__other' }))?.block, true);
  assert.equal((await allow({ ...call, toolName: 'mcp__other__effect' }))?.block, true);
  assert.equal((await allow({ ...call, input: null }))?.block, true);
});

test('MCP no permite iniciar prompt si faltan herramientas', async () => {
  await waitForMcpTools(['expected'], () => ['expected'], 0);
  await assert.rejects(waitForMcpTools(['expected'], () => ['other'], 0), /no registró/);
});
