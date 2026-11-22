import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfiguration } from '../src/config.ts';

const valid = { YOUR_GEAR_PROVIDER: 'openai', YOUR_GEAR_MODEL: 'example-model', YOUR_GEAR_API_KEY: 'private-key' };

test('prompt y configuración son deterministas', () => {
  assert.deepEqual(readConfiguration(['Hola', 'mundo'], valid), {
    prompt: 'Hola mundo', provider: 'openai', modelId: 'example-model', apiKey: 'private-key',
  });
});

test('config inválida no expone secretos', () => {
  assert.throws(() => readConfiguration(['Hola'], { YOUR_GEAR_API_KEY: 'secret-value' }), error => {
    assert.equal((error as Error).message.includes('secret-value'), false);
    return true;
  });
  assert.throws(() => readConfiguration([], valid), /Uso/);
});
