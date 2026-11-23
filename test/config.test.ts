import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfiguration, readSettings } from '../src/config.ts';

const valid = { YOUR_GEAR_PROVIDER: 'openai', YOUR_GEAR_MODEL: 'example-model', YOUR_GEAR_API_KEY: 'private-key' };

test('el modo por defecto es suscripción Pi sin API key', () => {
  assert.deepEqual(readConfiguration(['Hola', 'mundo'], {}), {
    prompt: 'Hola mundo', provider: 'openai', modelId: undefined, authMode: 'pi-subscription',
  });
});

test('configuración de entorno prevalece sobre proyecto y usuario sin activar API', t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const agent = join(root, 'user');
  const cwd = join(root, 'project');
  mkdirSync(agent);
  mkdirSync(join(cwd, '.your-gear'), { recursive: true });
  writeFileSync(join(agent, 'config.json'), JSON.stringify({ provider: 'openai', model: 'user' }));
  writeFileSync(join(cwd, '.your-gear', 'config.json'), JSON.stringify({ model: 'project' }));
  const settings = readSettings(cwd, agent);
  assert.equal(readConfiguration(['hola'], {}, settings).modelId, 'project');
  const config = readConfiguration(['hola'], { YOUR_GEAR_MODEL: 'env', YOUR_GEAR_API_KEY: 'secret' }, settings);
  assert.equal(config.modelId, 'env');
  assert.equal(config.authMode, 'pi-subscription');
  assert.equal(config.apiKey, undefined);
  writeFileSync(join(cwd, '.your-gear', 'config.json'), JSON.stringify({ authMode: 'api-key' }));
  assert.throws(() => readSettings(cwd, agent), /Opción de configuración inválida/);
  writeFileSync(join(cwd, '.your-gear', 'config.json'), '{');
  assert.throws(() => readSettings(cwd, agent), /JSON inválida/);
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
