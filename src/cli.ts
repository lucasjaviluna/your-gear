#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { stdin, stdout, stderr } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { readConfiguration } from './config.ts';
import { createToolCallHandler } from './gate.ts';

async function main(): Promise<void> {
  const { prompt, provider, modelId, apiKey } = readConfiguration(process.argv.slice(2), process.env);
  if (Number(process.versions.node.split('.')[0]) < 22 ||
      (Number(process.versions.node.split('.')[0]) === 22 && Number(process.versions.node.split('.')[1]) < 19)) {
    throw new Error('Se requiere Node.js >=22.19.0 (requisito de Pi SDK 1.6.0).');
  }
  const { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } =
    await import('@earendil-works/pi-coding-agent');

  const cwd = resolve(process.cwd());
  const agentDir = join(homedir(), '.your-gear');
  mkdirSync(agentDir, { recursive: true, mode: 0o700 });
  const modelRuntime = await ModelRuntime.create({
    authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json'),
  });
  const model = modelRuntime.getModel(provider, modelId);
  if (!model) throw new Error(`Modelo desconocido: ${provider}/${modelId}`);
  await modelRuntime.setRuntimeApiKey(provider, apiKey);

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
    extensionFactories: [(pi) => pi.on('tool_call', createToolCallHandler(cwd, approve))],
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
    await session.prompt(prompt);
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
