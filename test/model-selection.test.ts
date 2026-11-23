import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfiguration } from '../src/config.ts';
import { selectModel, type BasicModel } from '../src/model-selection.ts';

const models = [
  { provider: 'openai', id: 'example-chatgpt-model' },
  { provider: 'openai', id: 'another-model' },
];
function fakeRuntime(subscription = true) {
  const calls: string[] = [];
  return {
    calls,
    isUsingSubscription(provider: string) { calls.push(`subscription:${provider}`); return subscription; },
    async getAvailable(provider: string): Promise<readonly BasicModel[]> {
      calls.push(`available:${provider}`);
      return provider === 'openai' ? models : [];
    },
    getModel(provider: string, modelId: string): BasicModel | undefined {
      calls.push(`get:${provider}/${modelId}`);
      return models.find(m => m.provider === provider && m.id === modelId);
    },
    async setRuntimeApiKey(provider: string, _key: string) { calls.push(`set-key:${provider}`); },
  };
}

test('la suscripción selecciona modelo Pi disponible, sin llamar a setRuntimeApiKey', async () => {
  const runtime = fakeRuntime();
  const model = await selectModel(readConfiguration(['hola'], {}), runtime);
  assert.equal(model.id, 'example-chatgpt-model');
  assert.deepEqual(runtime.calls, ['subscription:openai', 'available:openai']);
});

test('modelo explícito se valida frente a los disponibles en suscripción', async () => {
  const runtime = fakeRuntime();
  const cfg = readConfiguration(['hola'], { YOUR_GEAR_MODEL: 'another-model' });
  assert.equal((await selectModel(cfg, runtime)).id, 'another-model');
  await assert.rejects(selectModel(readConfiguration(['hola'], { YOUR_GEAR_MODEL: 'inexistente' }), runtime), /no disponible/);
});

test('no hay fallback implícito a API key si falta login', async () => {
  const runtime = fakeRuntime(false);
  await assert.rejects(selectModel(readConfiguration(['hola'], {}), runtime), /Sign in with ChatGPT/);
  assert.deepEqual(runtime.calls, ['subscription:openai']);
});

test('API explícita utiliza clave únicamente en ese modo', async () => {
  const runtime = fakeRuntime(false);
  const cfg = readConfiguration(['hola'], {
    YOUR_GEAR_AUTH_MODE: 'api-key', YOUR_GEAR_PROVIDER: 'openai',
    YOUR_GEAR_MODEL: 'another-model', YOUR_GEAR_API_KEY: 'secret-key',
  });
  assert.equal((await selectModel(cfg, runtime)).id, 'another-model');
  assert.deepEqual(runtime.calls, ['set-key:openai', 'get:openai/another-model']);
});
