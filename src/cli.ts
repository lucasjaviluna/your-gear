#!/usr/bin/env node
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { stdout, stderr } from 'node:process';
import { requestApproval, serializeApprovals } from './approval.ts';
import { readConfiguration, readSettings, USAGE } from './config.ts';
import { createToolCallHandler } from './gate.ts';
import { approveMcpStart, controlledMcpExtension, mcpToolNames, readMcpServer, waitForMcpTools } from './mcp.ts';
import { selectModel } from './model-selection.ts';
import { createResponseOutput, redactError } from './response-output.ts';
import { createSessionManager, parseSessionArgs } from './sessions.ts';
import { resolveSkill } from './skills.ts';
import { createToolTrace, traceApproval, traceSession } from './tool-trace.ts';

async function main(controller: AbortController): Promise<void> {
  if (Number(process.versions.node.split('.')[0]) < 22 ||
      (Number(process.versions.node.split('.')[0]) === 22 && Number(process.versions.node.split('.')[1]) < 19)) {
    throw new Error('Se requiere Node.js >=22.19.0 (requisito de Pi SDK 1.6.0).');
  }

  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    stdout.write(USAGE + '\n');
    return;
  }
  if (args.length === 1 && args[0] === '--version') {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    stdout.write(manifest.version + '\n');
    return;
  }
  const showStatus = args.length === 2 && args[0] === 'auth' && args[1] === 'status';
  const listModels = args.length === 1 && args[0] === 'models';
  const sessionArgs = parseSessionArgs(args);
  const agentDir = join(homedir(), '.your-gear');
  const config = showStatus || listModels ? undefined : readConfiguration(sessionArgs.promptArgs, process.env, readSettings(process.cwd(), agentDir));

  const { createAgentSession, DefaultResourceLoader, ModelRuntime, SettingsManager } =
    await import('@earendil-works/pi-coding-agent');

  // Subscription mode intentionally uses Pi's own credential store. No token
  // reading, exporting, copying, or OAuth implementation is performed here.
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
  const skillPath = sessionArgs.skillPath ? resolveSkill(cwd, sessionArgs.skillPath) : undefined;
  const signal = controller.signal;
  const checkCancelled = () => { if (signal.aborted) throw new Error('La ejecución fue cancelada.'); };
  checkCancelled();
  const approve = traceApproval(serializeApprovals(
    description => requestApproval(description, signal, () => controller.abort()), signal,
  ), text => stderr.write(text));
  const mcpServer = sessionArgs.mcpName ? readMcpServer(agentDir, sessionArgs.mcpName) : undefined;
  if (mcpServer) {
    try { await approveMcpStart(mcpServer, cwd, approve); }
    catch (error) { checkCancelled(); throw error; }
  }
  checkCancelled();
  const mcpTools = mcpServer ? mcpToolNames(mcpServer) : [];
  const tools = ['read', 'write', 'edit', 'bash', ...mcpTools];
  const settingsManager = SettingsManager.inMemory({ defaultTools: tools });
  const authorize = createToolCallHandler(cwd, approve, mcpTools, signal);
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true,
    noThemes: true, noContextFiles: true, additionalSkillPaths: skillPath ? [skillPath] : [],
    extensionFactories: [...(mcpServer ? [controlledMcpExtension(mcpServer, agentDir)] : []), (pi) => { pi.on('tool_call', async (event) => {
      const result = await authorize(event);
      if (result?.block) stderr.write(`Your Gear: herramienta ${event.toolName} bloqueada: ${result.reason}\n`);
      return result;
    }); }],
  });
  await loader.reload();
  if (skillPath && (loader.getSkills().skills.length !== 1 || loader.getSkills().diagnostics.some(item => item.type === 'error'))) {
    throw new Error('No se pudo cargar la skill seleccionada. Revisá su formato.');
  }
  const sessionManager = await createSessionManager(cwd, agentDir, sessionArgs.mode);
  checkCancelled();
  const { session, extensionsResult } = await createAgentSession({
    cwd, agentDir, modelRuntime, model, settingsManager,
    sessionManager,
    resourceLoader: loader, tools,
  });
  traceSession(sessionArgs.mode, text => stderr.write(text));
  const output = createResponseOutput((text) => stdout.write(text));
  const traceTool = createToolTrace((text) => stderr.write(text), mcpTools);
  const unsubscribe = session.subscribe((event) => {
    output.onEvent(event);
    if (event.type === 'tool_execution_start' || event.type === 'tool_execution_end') traceTool(event);
  });
  const onAbort = () => { void session.abort().catch(() => stderr.write('Your Gear: no se pudo cancelar la sesión del SDK.\n')); };
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    checkCancelled();
    if (extensionsResult.errors.length > 0) {
      throw new Error(`Error cargando extensiones de seguridad (${extensionsResult.errors.length}).`);
    }
    if (mcpServer) {
      await session.bindExtensions({});
      await waitForMcpTools(mcpTools, () => session.agent.state.tools.map(tool => tool.name), 10000, signal);
      stderr.write(`Your Gear: MCP ${mcpServer.name} listo\n`);
    }
    checkCancelled();
    await session.prompt(config.prompt);
    checkCancelled();
    output.finish(session.getLastAssistantText());
  } finally {
    signal.removeEventListener('abort', onAbort);
    unsubscribe();
    try {
      if (mcpServer) await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
    } finally {
      session.dispose();
    }
  }
}

const controller = new AbortController();
const onSigint = () => controller.abort();
process.on('SIGINT', onSigint);
main(controller).catch((error: unknown) => {
  stderr.write(`Your Gear: ${redactError(error instanceof Error ? error.message : String(error))}\n`);
  process.exitCode = controller.signal.aborted ? 130 : 1;
}).finally(() => process.off('SIGINT', onSigint));
