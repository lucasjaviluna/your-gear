#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, stderr } from 'node:process';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { authorizeTool } from './policy.ts';

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(' ').trim();
  if (!prompt) throw new Error('Uso: your-gear "tu instrucción"');

  const provider = process.env.YOUR_GEAR_PROVIDER;
  const modelId = process.env.YOUR_GEAR_MODEL;
  const apiKey = process.env.YOUR_GEAR_API_KEY;
  if (!provider || !modelId || !apiKey) {
    throw new Error('Configurar YOUR_GEAR_PROVIDER, YOUR_GEAR_MODEL y YOUR_GEAR_API_KEY (API key admitida por el proveedor).');
  }

  // Dynamic import: missing SDK produces an explicit dependency error only after CLI validation.
  const {
    createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager,
  } = await import('@earendil-works/pi-coding-agent');

  const cwd = resolve(process.cwd());
  const agentDir = join(homedir(), '.your-gear');
  mkdirSync(agentDir, { recursive: true, mode: 0o700 });
  const modelRuntime = await ModelRuntime.create({
    authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json'),
  });
  const model = modelRuntime.getModel(provider, modelId);
  if (!model) throw new Error(`Modelo desconocido: ${provider}/${modelId}`);
  await modelRuntime.setRuntimeApiKey(provider, apiKey);

  const settingsManager = SettingsManager.inMemory({ defaultTools: ['read', 'write', 'edit', 'bash'] });
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true,
    noThemes: true, noContextFiles: true,
    extensionFactories: [(pi) => {
      pi.on('tool_call', async (event) => authorizeTool(
        { cwd, toolName: event.toolName, input: event.input },
        async (operation) => {
          if (!stdin.isTTY || !stdout.isTTY) return false; // headless fail closed
          const rl = createInterface({ input: stdin, output: stdout });
          try {
            const answer = await rl.question(`\n¿Autorizar ${operation}? [s/N] `);
            return answer.trim().toLowerCase() === 's';
          } finally {
            rl.close();
          }
        },
      ));
    }],
  });
  await loader.reload();
  const { session } = await createAgentSession({
    cwd, agentDir, modelRuntime, model, settingsManager,
    sessionManager: SessionManager.inMemory(cwd),
    resourceLoader: loader, tools: ['read', 'write', 'edit', 'bash'],
  });

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
