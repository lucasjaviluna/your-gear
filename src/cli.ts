#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { stdin, stdout, stderr } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { readConfiguration } from './config.ts';
import { createToolCallHandler } from './gate.ts';
import { selectModel } from './model-selection.ts';

async function main(): Promise<void> {
  if (Number(process.versions.node.split('.')[0]) < 22 ||
      (Number(process.versions.node.split('.')[0]) === 22 && Number(process.versions.node.split('.')[1]) < 19)) {
    throw new Error('Se requiere Node.js >=22.19.0 (requisito de Pi SDK 1.6.0).');
  }

  const args = process.argv.slice(2);
  const showStatus = args.length === 2 && args[0] === 'auth' && args[1] === 'status';
  const listModels = args.length === 1 && args[0] === 'models';
  const config = showStatus || listModels ? undefined : readConfiguration(args, process.env);

  const { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } =
    await import('@earendil-works/pi-coding-agent');

  // Subscription mode intentionally uses Pi's own credential store. No token
  // reading, exporting, copying, or OAuth implementation is performed here.
  const agentDir = join(homedir(), '.your-gear');
  const modelRuntime = !config || config.authMode === 'pi-subscription'
    ? await ModelRuntime.create()
    : await (async () => {
        mkdirSync(agentDir, { recursive: true, mode: 0o700 });
        return ModelRuntime.create({
          authPath: join(agentDir, 'auth.json'),
          modelsPath: join(agentDir, 'models.json'),
        });
      })();

  if (showStatus) {
    stdout.write(modelRuntime.isUsingSubscription('openai')
      ? 'ChatGPT conectado en Pi (proveedor openai, suscripción).\n'
      : 'No se detectó una suscripción ChatGPT activa para openai en Pi. Abrí pi y usá /login → OpenAI → Sign in with ChatGPT.\n');
    return;
  }
  if (listModels) {
    if (!modelRuntime.isUsingSubscription('openai')) {
      throw new Error('Primero iniciá sesión en Pi con /login → OpenAI → Sign in with ChatGPT.');
    }
    const models = await modelRuntime.getAvailable('openai');
    if (!models.length) throw new Error('No hay modelos ChatGPT disponibles en Pi.');
    stdout.write(models.map(({ id }) => id).join('\n') + '\n');
    return;
  }

  if (!config) throw new Error('Configuración no encontrada.');
  const model = await selectModel(config, modelRuntime);
  stderr.write(`Your Gear: ${model.provider}/${model.id} (${config.authMode})\n`);

  const cwd = resolve(process.cwd());
  const approve = async (operation: string): Promise<boolean> => {
    if (!stdin.isTTY || !stdout.isTTY) return false;
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      return (await rl.question(`\n¿Autorizar ${operation}? [s/N] `)).trim().toLowerCase() === 's';
    } finally {
      rl.close();
    }
  };
  const settingsManager = SettingsManager.inMemory({ defaultTools: ['read', 'write', 'edit', 'bash'] });
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true,
    noThemes: true, noContextFiles: true,
    extensionFactories: [(pi) => { pi.on('tool_call', createToolCallHandler(cwd, approve)); }],
  });
  await loader.reload();
  const { session, extensionsResult } = await createAgentSession({
    cwd, agentDir, modelRuntime, model, settingsManager,
    sessionManager: SessionManager.inMemory(cwd),
    resourceLoader: loader, tools: ['read', 'write', 'edit', 'bash'],
  });
  if (extensionsResult.errors.length > 0) {
    session.dispose();
    throw new Error(`Error cargando extensiones de seguridad (${extensionsResult.errors.length}).`);
  }
  const unsubscribe = session.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      stdout.write(event.assistantMessageEvent.delta);
    }
  });
  const onSigint = () => { void session.abort(); };
  process.on('SIGINT', onSigint);
  try {
    await session.prompt(config.prompt);
    stdout.write('\n');
  } finally {
    process.off('SIGINT', onSigint);
    unsubscribe();
    session.dispose();
  }
}

main().catch((error: unknown) => {
  stderr.write(`Your Gear: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
