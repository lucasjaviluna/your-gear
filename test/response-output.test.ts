import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createResponseOutput, redactError } from '../src/response-output.ts';

function setup() {
  let output = '';
  const reporter = createResponseOutput(text => { output += text; });
  return { reporter, output: () => output };
}

test('streaming imprime deltas una única vez', () => {
  const { reporter, output } = setup();
  reporter.onEvent({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'Ho' } });
  reporter.onEvent({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'la' } });
  reporter.onEvent({ type: 'message_end', message: {
    role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: 'Hola' }],
  } });
  reporter.finish('Hola');
  assert.equal(output(), 'Hola\n');
});

test('fallback imprime respuesta final cuando no hubo streaming', () => {
  const { reporter, output } = setup();
  reporter.onEvent({ type: 'message_end', message: {
    role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: '¡Hola!' }],
  } });
  reporter.finish();
  assert.equal(output(), '¡Hola!\n');
});

test('fallback getLastAssistantText funciona sin message_end', () => {
  const { reporter, output } = setup();
  reporter.finish('respuesta');
  assert.equal(output(), 'respuesta\n');
});

test('respuesta parcial se completa sin duplicar', () => {
  const { reporter, output } = setup();
  reporter.onEvent({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'Ho' } });
  reporter.onEvent({ type: 'message_end', message: {
    role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: 'Hola' }],
  } });
  reporter.finish();
  assert.equal(output(), 'Hola\n');
});

test('stopReason error expone diagnóstico legible y redactado', () => {
  const { reporter } = setup();
  reporter.onEvent({ type: 'message_end', message: {
    role: 'assistant', stopReason: 'error', errorMessage: 'HTTP 403 token=hidden; Bearer abc.def.ghi',
    content: [],
  } });
  assert.throws(() => reporter.finish(), err => {
    const message = (err as Error).message;
    assert.match(message, /HTTP 403/);
    assert.doesNotMatch(message, /abc\.def\.ghi/);
    return true;
  });
});

test('finalización sin texto informa fallo en lugar de salir silenciosamente', () => {
  const { reporter, output } = setup();
  assert.throws(() => reporter.finish(), /sin contenido de texto/);
  assert.equal(output(), '');
});

test('estados de cancelación y longitud se consideran errores', () => {
  for (const stopReason of ['aborted', 'length']) {
    const { reporter } = setup();
    reporter.onEvent({ type: 'message_end', message: {
      role: 'assistant', stopReason, content: [],
    } });
    assert.throws(() => reporter.finish());
  }
});

test('agent_settled aborted se respeta', () => {
  const { reporter } = setup();
  reporter.onEvent({ type: 'agent_settled', aborted: true });
  assert.throws(() => reporter.finish(), /cancelada/);
});

test('sanitiza claves y URLs en mensajes', () => {
  const result = redactError('Bearer secret-value; key sk-abc123 and https://host/path?token=secret');
  assert.doesNotMatch(result, /secret-value|sk-abc123|host\/path/);
  assert.match(result, /REDACTED/);
});
