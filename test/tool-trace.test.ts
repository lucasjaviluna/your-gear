import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createToolTrace, traceApproval, traceSession } from '../src/tool-trace.ts';

test('muestra inicio y resultado sin imprimir argumentos ni contenido de herramientas', () => {
  let output = '';
  const trace = createToolTrace(text => { output += text; });
  const start = { type: 'tool_execution_start', toolName: 'write', args: { content: 'secreto' } };
  const end = { type: 'tool_execution_end', toolName: 'write', isError: true, result: 'secreto' };
  trace(start);
  trace(end);
  assert.match(output, /write solicitada/);
  assert.match(output, /write finalizó con error/);
  assert.doesNotMatch(output, /secreto/);
  trace({ type: 'tool_execution_start', toolName: 'custom\u001b[31m' });
  assert.doesNotMatch(output, /custom/);
});

test('informa aprobación y sesión sin registrar el detalle privado', async () => {
  let output = '';
  const write = (text: string) => { output += text; };
  assert.equal(await traceApproval(async () => true, write)('ruta secreta'), true);
  assert.equal(await traceApproval(async () => false, write)('ruta secreta'), false);
  await assert.rejects(traceApproval(async () => { throw new Error('secreto'); }, write)('ruta secreta'));
  for (const mode of ['memory', 'persist', 'continue'] as const) traceSession(mode, write);
  assert.match(output, /aprobación concedida/);
  assert.match(output, /aprobación no concedida/);
  assert.match(output, /no se pudo solicitar aprobación/);
  assert.match(output, /sesión en memoria/);
  assert.match(output, /sesión nueva persistente/);
  assert.match(output, /sesión reanudada/);
  assert.doesNotMatch(output, /secreta|secreto/);
});
