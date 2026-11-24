#!/usr/bin/env node
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { stdin, stdout, stderr } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { requestApproval, serializeApprovals } from './approval.ts';
import { readConfiguration, readSettings, USAGE } from './config.ts';
import { createToolCallHandler } from './gate.ts';
import { analysisPrompt } from './assessment.ts';
import { approveContext, collectContext, parsePlanningArgs } from './context-engine.ts';
import { selectModel } from './model-selection.ts';
import { createResponseOutput, redactError } from './response-output.ts';
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
  const planning = args[0] === '--plan';
  const review = args[0] === '--review-route' || planning;
  const classify = args[0] === '--analyze-only' || review;
  if (review && (!stdin.isTTY || !stderr.isTTY)) {
    throw new Error('La revisión de ruta requiere una terminal interactiva.');
  }
  const planningArgs = planning ? parsePlanningArgs(args.slice(1)) : undefined;
  const classificationRequest = classify ? analysisPrompt(planningArgs?.promptArgs ?? args.slice(1)) : undefined;
  const { createSessionManager, parseSessionArgs } = await import('./sessions.ts');
  const { approveMcpStart, controlledMcpExtension, mcpToolNames, readMcpServer, waitForMcpTools } = await import('./mcp.ts');
  const showStatus = args.length === 2 && args[0] === 'auth' && args[1] === 'status';
  const listModels = args.length === 1 && args[0] === 'models';
  const sessionArgs = parseSessionArgs(classify ? ['classify'] : args);
  // No MCP server may start without an interactive startup approval.
  // Reject before settings, provider authentication or extension loading.
  if (sessionArgs.mcpName && (!stdin.isTTY || !stdout.isTTY)) {
    throw new Error('MCP requiere una terminal interactiva para autorizar el inicio.');
  }
  const agentDir = join(homedir(), '.your-gear');
  const settings = showStatus || listModels ? undefined : readSettings(process.cwd(), agentDir);
  const config = showStatus || listModels ? undefined : readConfiguration(sessionArgs.promptArgs, process.env, settings, classify ? 'classifier' : 'default');
  const plannerConfig = planning ? readConfiguration(['plan'], process.env, settings, 'planner') : undefined;

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
  if (classificationRequest !== undefined) {
    if (controller.signal.aborted) throw new Error('La ejecución fue cancelada.');
    const { createClassifierSession, classifyWithSession } = await import('./assessment-agent.ts');
    const session = await createClassifierSession({ cwd, agentDir, modelRuntime, model });
    const assessment = await classifyWithSession(session, classificationRequest, controller.signal);
    if (!review) {
      stdout.write(JSON.stringify(assessment, null, 2) + '\n');
      return;
    }
    const { reviewRoute } = await import('./route-review.ts');
    const ask = async (description: string): Promise<string> => {
      const rl = createInterface({ input: stdin, output: stderr });
      const onInterrupt = () => { controller.abort(); rl.close(); };
      rl.on('SIGINT', onInterrupt);
      let onClose: () => void = () => {};
      const closed = new Promise<string>(resolve => { onClose = () => resolve(''); rl.once('close', onClose); });
      try { return await Promise.race([rl.question(description, { signal: controller.signal }), closed]); }
      catch { return ''; }
      finally { rl.off('SIGINT', onInterrupt); rl.off('close', onClose); rl.close(); }
    };
    const decision = await reviewRoute(assessment, ask, controller.signal);
    if (planning && decision.status === 'selected' && decision.route === 'task' && plannerConfig) {
      if (controller.signal.aborted) throw new Error('La ejecución fue cancelada.');
      const context = collectContext(cwd, planningArgs?.files, controller.signal);
      const contextSummary = { paths: context.entries.map(entry => entry.path), bytes: context.bytes, digest: context.digest };
      if (!await approveContext(context, ask, controller.signal)) {
        stdout.write(JSON.stringify({ assessment, decision, context: contextSummary, planDecision: { status: 'cancelled' } }, null, 2) + '\n');
        process.exitCode = 1;
        return;
      }
      const plannerModel = await selectModel(plannerConfig, modelRuntime);
      stderr.write(`Your Gear planner: ${plannerModel.provider}/${plannerModel.id}\n`);
      const { createPlannerSession, planWithSession } = await import('./planner-agent.ts');
      const { reviewPlan } = await import('./plan.ts');
      const planner = await createPlannerSession({ cwd, agentDir, modelRuntime, model: plannerModel });
      const plan = await planWithSession(planner, classificationRequest, assessment, controller.signal, context);
      const planDecision = await reviewPlan(plan, ask, controller.signal);
      stdout.write(JSON.stringify({ assessment, decision, context: contextSummary, plan, planDecision }, null, 2) + '\n');
      if (planDecision.status === 'cancelled') process.exitCode = 1;
      return;
    }
    if (planning && decision.status === 'selected') {
      stderr.write('En este incremento solo se genera un plan para la ruta task. No se ejecutó la solicitud.\n');
    }
    stdout.write(JSON.stringify({ assessment, decision }, null, 2) + '\n');
    if (decision.status === 'cancelled') process.exitCode = 1;
    return;
  }
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
