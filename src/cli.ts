#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { stdout, stderr } from 'node:process';
import { requestApproval } from './approval.ts';
import { readConfiguration } from './config.ts';
import { createToolCallHandler } from './gate.ts';
import { selectModel } from './model-selection.ts';
import { createResponseOutput, redactError } from './response-output.ts';
import { createSessionManager, parseSessionArgs } from './sessions.ts';

async function main(): Promise<void> {
  if (Number(process.versions.node.split('.')[0]) < 22 ||
      (Number(process.versions.node.split('.')[0]) === 22 && Number(process.versions.node.split('.')[1]) < 19)) {
    throw new Error('Se requiere Node.js >=22.19.0 (requisito de Pi SDK 1.6.0).');
  }

  const args = process.argv.slice(2);
  const showStatus = args.length === 2 && args[0] === 'auth' && args[1] === 'status';
  const listModels = args.length === 1 && args[0] === 'models';
  const sessionArgs = parseSessionArgs(args);
  const config = showStatus || listModels ? undefined : readConfiguration(sessionArgs.promptArgs, process.env);

  const { createAgentSession, DefaultResourceLoader, ModelRuntime, SettingsManager } =
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
    const codexIds = new Set(modelRuntime.getModels('openai-codex').map(({ id }) => id));
    const models = (await modelRuntime.getAvailable('openai')).filter(({ id }) => codexIds.has(id));
    if (!models.length) throw new Error('No hay modelos compatibles con Codex disponibles en Pi; actualizá Pi o revisá la sesión de ChatGPT.');
    stdout.write(models.map(({ id }) => id).join('\n') + '\n');
    return;
  }

  if (!config) throw new Error('Configuración no encontrada.');
  const model = await selectModel(config, modelRuntime);
  stderr.write(`Your Gear: ${model.provider}/${model.id} (${config.authMode})\n`);

  const cwd = resolve(process.cwd());
  const settingsManager = SettingsManager.inMemory({ defaultTools: ['read', 'write', 'edit', 'bash'] });
  const authorize = createToolCallHandler(cwd, requestApproval);
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true,
    noThemes: true, noContextFiles: true,
    extensionFactories: [(pi) => { pi.on('tool_call', async (event) => {
      const result = await authorize(event);
      if (result?.block) stderr.write(`Your Gear: herramienta ${event.toolName} bloqueada: ${result.reason}\n`);
      return result;
    }); }],
  });
  await loader.reload();
  const { session, extensionsResult } = await createAgentSession({
    cwd, agentDir, modelRuntime, model, settingsManager,
    sessionManager: await createSessionManager(cwd, agentDir, sessionArgs.mode),
    resourceLoader: loader, tools: ['read', 'write', 'edit', 'bash'],
  });
  if (extensionsResult.errors.length > 0) {
    session.dispose();
    throw new Error(`Error cargando extensiones de seguridad (${extensionsResult.errors.length}).`);
  }
  const output = createResponseOutput((text) => stdout.write(text));
  const unsubscribe = session.subscribe((event) => output.onEvent(event));
  const onSigint = () => { void session.abort(); };
  process.on('SIGINT', onSigint);
  try {
    await session.prompt(config.prompt);
    output.finish(session.getLastAssistantText());
  } finally {
    process.off('SIGINT', onSigint);
    unsubscribe();
    session.dispose();
  }
}

main().catch((error: unknown) => {
  stderr.write(`Your Gear: ${redactError(error instanceof Error ? error.message : String(error))}\n`);
  process.exitCode = 1;
});
