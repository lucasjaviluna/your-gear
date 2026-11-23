import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfiguration } from '../src/config.ts';

const valid = { YOUR_GEAR_PROVIDER: 'openai', YOUR_GEAR_MODEL: 'example-model', YOUR_GEAR_API_KEY: 'private-key' };

test('el modo por defecto es suscripción Pi sin API key', () => {
  assert.deepEqual(readConfiguration(['Hola', 'mundo'], {}), {
    prompt: 'Hola mundo', provider: 'openai', modelId: undefined, authMode: 'pi-subscription',
  });
});

test('una API key presente no activa facturación por API por accidente', () => {
  const config = readConfiguration(['hola'], valid);
  assert.equal(config.authMode, 'pi-subscription');
  assert.equal(config.apiKey, undefined);
});

test('api-key es un modo explícito y admite otros proveedores', () => {
  const config = readConfiguration(['hola'], {
    ...valid, YOUR_GEAR_AUTH_MODE: 'api-key', YOUR_GEAR_PROVIDER: 'anthropic',
  });
  assert.deepEqual(config, {
    prompt: 'hola', provider: 'anthropic', modelId: 'example-model',
    authMode: 'api-key', apiKey: 'private-key',
  });
});

test('auth inválida y Claude suscripción son rechazadas', () => {
  assert.throws(() => readConfiguration(['hola'], { YOUR_GEAR_AUTH_MODE: 'foo' }), /pi-subscription/);
  assert.throws(() => readConfiguration(['hola'], { YOUR_GEAR_PROVIDER: 'anthropic' }), /Claude OAuth/);
  assert.throws(() => readConfiguration(['hola'], { YOUR_GEAR_AUTH_MODE: 'api-key' }), /YOUR_GEAR_API_KEY/);
});

test('los errores no imprimen secretos ni permiten un prompt vacío', () => {
  assert.throws(() => readConfiguration([], valid), /Uso/);
  assert.throws(() => readConfiguration(['hola'], { YOUR_GEAR_AUTH_MODE: 'api-key', YOUR_GEAR_API_KEY: '   ' }), err => {
    assert.equal((err as Error).message.includes('private-key'), false);
    return true;
  });
});
