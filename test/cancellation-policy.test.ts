import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serializeApprovals } from '../src/approval.ts';
import { createToolCallHandler } from '../src/gate.ts';
import { waitForMcpTools } from '../src/mcp.ts';

test('aprobaciones concurrentes se presentan de a una y en orden', async () => {
  let release!: (value: boolean) => void;
  const first = new Promise<boolean>(resolve => { release = resolve; });
  const seen: string[] = [];
  const approve = serializeApprovals(async description => {
    seen.push(description);
    return description === 'first' ? first : true;
  });
  const a = approve('first');
  const b = approve('second');
  await Promise.resolve();
  assert.deepEqual(seen, ['first']);
  release(false);
  assert.equal(await a, false);
  assert.equal(await b, true);
  assert.deepEqual(seen, ['first', 'second']);
});

test('cancelación invalida aprobación tardía, cola y nuevas operaciones', async () => {
  const controller = new AbortController();
  let release!: (value: boolean) => void;
  const pending = new Promise<boolean>(resolve => { release = resolve; });
  let questions = 0;
  const approve = serializeApprovals(async () => { questions++; return pending; }, controller.signal);
  const gate = createToolCallHandler(process.cwd(), approve, ['mcp__fixture__effect'], controller.signal);
  const request = { toolName: 'mcp__fixture__effect', input: {} };
  const a = gate(request);
  const b = gate(request);
  await Promise.resolve();
  assert.equal(questions, 1);
  controller.abort();
  release(true);
  assert.equal((await a)?.block, true);
  assert.equal((await b)?.block, true);
  assert.equal((await gate(request))?.block, true);
  assert.equal((await gate({ toolName: 'read', input: { path: 'README.md' } }))?.block, true);
  assert.equal(questions, 1);
});

test('una aprobación fallida no bloquea la cola', async () => {
  const approve = serializeApprovals(async description => {
    if (description === 'error') throw new Error('fixture');
    return true;
  });
  const a = approve('error');
  const b = approve('next');
  await assert.rejects(a, /fixture/);
  assert.equal(await b, true);
});

test('espera MCP se cancela incluso si las herramientas llegan después', async () => {
  const controller = new AbortController();
  const waiting = waitForMcpTools(['expected'], () => [], 10000, controller.signal);
  controller.abort();
  await assert.rejects(waiting, /cancelada/);
  await assert.rejects(waitForMcpTools(['expected'], () => ['expected'], 10000, controller.signal), /cancelada/);
});
