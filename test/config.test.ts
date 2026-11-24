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

test('configuración del clasificador hereda y combina usuario y proyecto sin modificar el modelo directo', t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-classifier-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const agent = join(root, 'user');
  const cwd = join(root, 'project');
  mkdirSync(agent);
  mkdirSync(join(cwd, '.your-gear'), { recursive: true });
  writeFileSync(join(agent, 'config.json'), JSON.stringify({ provider: 'openai', model: 'default', agents: { classifier: { provider: 'openai', model: 'user-classifier' } } }));
  writeFileSync(join(cwd, '.your-gear', 'config.json'), JSON.stringify({ agents: { classifier: { model: 'project-classifier' } } }));
  const settings = readSettings(cwd, agent);
  assert.deepEqual(settings.agents?.classifier, { provider: 'openai', model: 'project-classifier' });
  assert.equal(readConfiguration(['hola'], {}, settings).modelId, 'default');
  assert.equal(readConfiguration(['hola'], {}, settings, 'classifier').modelId, 'project-classifier');
  assert.equal(readConfiguration(['hola'], { YOUR_GEAR_MODEL: 'env' }, settings, 'classifier').modelId, 'env');
  assert.equal(readConfiguration(['hola'], { YOUR_GEAR_MODEL: 'env', YOUR_GEAR_CLASSIFIER_MODEL: 'role-env' }, settings, 'classifier').modelId, 'role-env');
  assert.equal(readConfiguration(['hola'], { YOUR_GEAR_CLASSIFIER_MODEL: 'role-env' }, settings).modelId, 'default');
  assert.equal(readConfiguration(['hola'], {}, settings, 'classifier').authMode, 'pi-subscription');
  assert.throws(() => readConfiguration(['hola'], { YOUR_GEAR_PROVIDER: 'other', YOUR_GEAR_AUTH_MODE: 'api-key', YOUR_GEAR_API_KEY: 'secret' }, settings, 'classifier'), /proveedor de autenticación/);
  for (const agents of [null, [], { verifier: {} }, { classifier: { apiKey: 'secret' } }, { classifier: { authMode: 'api-key' } }, { classifier: { model: 123 } }]) {
    writeFileSync(join(cwd, '.your-gear', 'config.json'), JSON.stringify({ agents }));
    assert.throws(() => readSettings(cwd, agent), /Opción de configuración inválida/);
  }
});

test('planner usa modelo independiente y conserva credenciales del proveedor', t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-planner-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const agent = join(root, 'user');
  const cwd = join(root, 'project');
  mkdirSync(agent);
  mkdirSync(join(cwd, '.your-gear'), { recursive: true });
  writeFileSync(join(agent, 'config.json'), JSON.stringify({ model: 'default', agents: { classifier: { model: 'class' }, planner: { provider: 'openai', model: 'user-plan' } } }));
  writeFileSync(join(cwd, '.your-gear', 'config.json'), JSON.stringify({ agents: { planner: { model: 'project-plan' } } }));
  const settings = readSettings(cwd, agent);
  assert.equal(readConfiguration(['hola'], {}, settings, 'planner').modelId, 'project-plan');
  assert.equal(readConfiguration(['hola'], { YOUR_GEAR_PLANNER_MODEL: 'env-plan' }, settings, 'planner').modelId, 'env-plan');
  assert.equal(readConfiguration(['hola'], {}, settings, 'classifier').modelId, 'class');
  assert.equal(readConfiguration(['hola'], {}, settings).modelId, 'default');
  assert.throws(() => readConfiguration(['hola'], { YOUR_GEAR_PROVIDER: 'other' }, settings, 'planner'), /proveedor de autenticación/);
});

test('executor usa modelo independiente y conserva credenciales del proveedor', t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-executor-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const agent = join(root, 'user');
  const cwd = join(root, 'project');
  mkdirSync(agent);
  mkdirSync(join(cwd, '.your-gear'), { recursive: true });
  writeFileSync(join(agent, 'config.json'), JSON.stringify({ model: 'default', agents: { executor: { provider: 'openai', model: 'user-exec' }, planner: { model: 'plan' } } }));
  writeFileSync(join(cwd, '.your-gear', 'config.json'), JSON.stringify({ agents: { executor: { model: 'project-exec' } } }));
  const settings = readSettings(cwd, agent);
  assert.equal(readConfiguration(['hola'], {}, settings, 'executor').modelId, 'project-exec');
  assert.equal(readConfiguration(['hola'], { YOUR_GEAR_EXECUTOR_MODEL: 'env-exec' }, settings, 'executor').modelId, 'env-exec');
  assert.equal(readConfiguration(['hola'], {}, settings, 'planner').modelId, 'plan');
  assert.equal(readConfiguration(['hola'], {}, settings).modelId, 'default');
  assert.throws(() => readConfiguration(['hola'], { YOUR_GEAR_PROVIDER: 'other' }, settings, 'executor'), /proveedor de autenticación/);
});
