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
import { parseTaskArgs, runSelectedTest, type TestEvidence } from './verification-evidence.ts';
import { type VerificationResult } from './verification.ts';
import { createWorkflowJournal, inspectWorkflow, listWorkflows, type WorkflowJournal } from './workflow-journal.ts';
import { prepareRecovery, assertRecoverySource, recoveryRequest } from './workflow-recovery.ts';
import type { WorkflowMemory } from './memory/workflow-memory.ts';
import { selectModel } from './model-selection.ts';
import { createResponseOutput, redactError } from './response-output.ts';
import { resolveSkill } from './skills.ts';
import { createToolTrace, traceApproval, traceSession } from './tool-trace.ts';

async function main(controller: AbortController, state: { journal?: WorkflowJournal; memory?: WorkflowMemory }): Promise<void> {
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
  if (args[0] === 'memory') {
    const { parseMemoryCommand, runMemoryCommand } = await import('./memory/commands.ts');
    const { connectYtk } = await import('./memory/ytk.ts');
    const { safePreview } = await import('./verification-evidence.ts');
    const result = await runMemoryCommand(parseMemoryCommand(args.slice(1)), {
      cwd: process.cwd(), agentDir: join(homedir(), '.your-gear'),
      interactive: Boolean(stdin.isTTY && stdout.isTTY), signal: controller.signal,
      approve: description => requestApproval(description, controller.signal, () => controller.abort()),
      connect: config => connectYtk(config, controller.signal),
    });
    stdout.write(safePreview(result) + '\n');
    return;
  }
  if (args[0] === 'workflows' && args.length === 1) {
    stdout.write(JSON.stringify(listWorkflows(process.cwd(), join(homedir(), '.your-gear')), null, 2) + '\n');
    return;
  }
  if (args[0] === 'workflow' && args.length === 2) {
    stdout.write(JSON.stringify(inspectWorkflow(process.cwd(), join(homedir(), '.your-gear'), args[1]), null, 2) + '\n');
    return;
  }
  if (args[0] === 'workflows' || args[0] === 'workflow') throw new Error('Uso: your-gear workflows | your-gear workflow ID');
  const recovering = args[0] === '--recover';
  const executing = args[0] === '--run-task' || recovering;
  let taskStart = recovering ? 2 : 1;
  const explicitRecord = !recovering && executing && args[taskStart] === '--record';
  if (explicitRecord) taskStart++;
  const useMemory = executing && args[taskStart] === '--memory';
  if (useMemory) taskStart++;
  const recording = recovering || explicitRecord || useMemory;
  const planning = args[0] === '--plan' || executing;
  const review = args[0] === '--review-route' || planning;
  const classify = args[0] === '--analyze-only' || review;
  if (review && (!stdin.isTTY || !stderr.isTTY)) {
    throw new Error('La revisión de ruta requiere una terminal interactiva.');
  }
  if (recovering && args.length > 1 && (!args[1] || args[1].startsWith('-'))) throw new Error('Uso: your-gear --recover ID --context archivo "trabajo pendiente"');
  const taskArgs = executing ? parseTaskArgs(args.slice(taskStart)) : undefined;
  const planningArgs = taskArgs ?? (planning ? parsePlanningArgs(args.slice(1)) : undefined);
  const assisted = recovering && taskArgs?.promptArgs.length === 0;
  let request = classify && !assisted ? analysisPrompt(planningArgs?.promptArgs ?? args.slice(1)) : undefined;
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

  let assistedDigest: string | undefined;
  const memoryOptions = { cwd: process.cwd(), agentDir: join(homedir(), '.your-gear'), ask, signal: controller.signal, warn: (message:string) => stderr.write(message) };
  if (recovering && args.length === 1) {
    const { listRecoveries } = await import('./memory/workflow-memory.ts');
    const { safePreview } = await import('./verification-evidence.ts');
    stdout.write(safePreview(await listRecoveries(memoryOptions)) + '\n');
    stderr.write('Seleccioná un UUID y ejecutá --recover ID. Los registros sin cierre podrían seguir activos.\n');
    return;
  }
  if (assisted && taskArgs) {
    const { recoverFromMemory } = await import('./memory/workflow-memory.ts');
    let restored;
    try { restored = await recoverFromMemory(memoryOptions,args[1],taskArgs.files); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error('No se pudo recuperar memoria válida. Usá --recover ID --context archivo "trabajo pendiente" para recuperación manual.');
    }
    if (!restored) { stdout.write(JSON.stringify({status:'cancelled'}) + '\n'); process.exitCode=1; return; }
    request = restored.remaining;
    assistedDigest = restored.parentDigest;
    taskArgs.files = restored.files;
    // Validate actual files before starting the new workflow, not just historical names.
    try { collectContext(process.cwd(), taskArgs.files, controller.signal); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error('Las rutas históricas ya no son utilizables. Repetí --recover ID con --context archivo actualizado.');
    }
  }
  const classificationRequest = recovering && request !== undefined ? recoveryRequest(request) : request;
  const recovery = recovering && request !== undefined ? await prepareRecovery({
    cwd: process.cwd(), agentDir: join(homedir(), '.your-gear'), id: args[1], remaining: request, files: taskArgs?.files ?? [],
  }, ask, controller.signal) : undefined;
  if (recovering && !recovery) {
    stdout.write(JSON.stringify({ status: 'cancelled' }, null, 2) + '\n');
    process.exitCode = 1;
    return;
  }
  if (assistedDigest && recovery?.parentDigest !== assistedDigest) throw new Error('El registro anterior cambió; revisá la recuperación.');
  if (recording) {
    state.journal = createWorkflowJournal(process.cwd(), join(homedir(), '.your-gear'));
    stderr.write('Your Gear workflow: ' + state.journal.id + '\n');
    if (recovery) state.journal.record({ kind: 'recovery', ...recovery });
    state.journal.transition('classifying');
  }
  const journal = state.journal;
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
  const executorConfig = executing ? readConfiguration(['execute'], process.env, settings, 'executor') : undefined;
  const verifierConfig = executing ? readConfiguration(['verify'], process.env, settings, 'verifier') : undefined;

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
    journal?.transition('route-review');
    const decision = await reviewRoute(assessment, ask, controller.signal);
    journal?.record({ kind: 'route', recommended: assessment.recommendedRoute, decision: decision.status === 'selected' ? decision.route : decision.status });
    if (executing && (assessment.recommendedRoute !== 'task' || decision.status !== 'selected' || decision.route !== 'task')) {
      stdout.write(JSON.stringify({ workflowId: journal?.id, assessment, decision, execution: { status: 'blocked', reason: 'La ejecución experimental requiere recomendación y selección de task.' } }, null, 2) + '\n');
      journal?.finish(decision.status === 'cancelled' ? 'cancelled' : 'blocked');
      process.exitCode = 1;
      return;
    }
    if (planning && decision.status === 'selected' && decision.route === 'task' && plannerConfig) {
      if (controller.signal.aborted) throw new Error('La ejecución fue cancelada.');
      journal?.transition('context-review');
      const context = collectContext(cwd, planningArgs?.files, controller.signal);
      const contextSummary = { paths: context.entries.map(entry => entry.path), bytes: context.bytes, digest: context.digest };
      const contextApproved = await approveContext(context, ask, controller.signal);
      journal?.record({ kind: 'context', digest: context.digest, files: context.entries.length, approved: contextApproved });
      if (!contextApproved) {
        journal?.finish('cancelled');
        stdout.write(JSON.stringify({ workflowId: journal?.id, assessment, decision, context: contextSummary, planDecision: { status: 'cancelled' } }, null, 2) + '\n');
        process.exitCode = 1;
        return;
      }
      journal?.transition('planning');
      const plannerModel = await selectModel(plannerConfig, modelRuntime);
      stderr.write(`Your Gear planner: ${plannerModel.provider}/${plannerModel.id}\n`);
      const { createPlannerSession, planWithSession } = await import('./planner-agent.ts');
      const { reviewPlan } = await import('./plan.ts');
      const planner = await createPlannerSession({ cwd, agentDir, modelRuntime, model: plannerModel });
      const plan = await planWithSession(planner, classificationRequest, assessment, controller.signal, context);
      journal?.transition('plan-review');
      const planDecision = await reviewPlan(plan, ask, controller.signal);
      journal?.record({ kind: 'plan', digest: plan.digest, version: plan.version, criteria: plan.acceptanceCriteria.length, decision: planDecision.status });
      if (useMemory && journal && planDecision.status === 'approved') {
        const { openWorkflowMemory } = await import('./memory/workflow-memory.ts');
        state.memory = await openWorkflowMemory(memoryOptions,journal,plan,context.entries.map(e=>e.path));
        await state.memory?.checkpoint('plan','Plan histórico aprobado; ninguna implementación confirmada en este checkpoint.');
      }
      if (executing && executorConfig) {
        const { executeApprovedTask } = await import('./task-orchestrator.ts');
        const { createExecutorSession, executeWithSession } = await import('./executor-agent.ts');
        const refreshContext = () => collectContext(cwd, planningArgs?.files, controller.signal);
        if (recovery) assertRecoverySource(cwd, agentDir, recovery);
        journal?.transition('execution-review');
        const execution = await executeApprovedTask({ request: classificationRequest, assessment, decision, context, plan, planDecision }, {
          signal: controller.signal, refreshContext, ask,
          execute: async message => {
            if (recovery) assertRecoverySource(cwd, agentDir, recovery);
            journal?.transition('executing');
            const executorModel = await selectModel(executorConfig, modelRuntime);
            stderr.write(`Your Gear executor: ${executorModel.provider}/${executorModel.id}\n`);
            const executor = await createExecutorSession({ cwd, agentDir, modelRuntime, model: executorModel },
              async description => {
                const approved = (await ask('¿Autorizar ' + description + '? [s/N] ')).trim().toLowerCase() === 's';
                if (approved && recovery) assertRecoverySource(cwd, agentDir, recovery);
                journal?.record({ kind: 'tool-approval', approved });
                return approved;
              },
              controller.signal);
            try {
              if (recovery) assertRecoverySource(cwd, agentDir, recovery);
              if (refreshContext().digest !== context.digest) throw new Error('El contexto cambió antes de ejecutar.');
              if (controller.signal.aborted) throw new Error('La ejecución fue cancelada.');
            } catch (error) {
              executor.session.dispose();
              throw error;
            }
            return executeWithSession(executor, message, controller.signal);
          },
        });
        const tests: TestEvidence[] = [];
        let verification: VerificationResult | undefined;
        if (execution.status === 'awaiting-verification' && verifierConfig) {
          journal?.record({ kind: 'execution', blockedCalls: execution.report.blockedCalls, toolErrors: execution.report.toolErrors });
          await state.memory?.checkpoint('execution','Ejecutor retornó; llamadas bloqueadas: '+execution.report.blockedCalls+'; errores de herramientas: '+execution.report.toolErrors+'. El trabajo restante requiere inspección.');
          journal?.transition('verifying');
          try {
            if (!execution.report.blockedCalls && !execution.report.toolErrors) {
              for (const path of taskArgs?.tests ?? []) {
                const test = await runSelectedTest(cwd, path, async description => {
                  const answer = await ask(description);
                  if (answer.trim().toLowerCase() === 's' && recovery) assertRecoverySource(cwd, agentDir, recovery);
                  journal?.record({ kind: 'verification-gate', gate: 'test', approved: answer.trim().toLowerCase() === 's' });
                  return answer;
                }, controller.signal);
                tests.push(test);
                journal?.record({ kind: 'test', status: test.status, exitCode: test.exitCode, outputTruncated: test.outputTruncated });
                if (test.status !== 'exit-zero') break;
              }
            }
            const after = refreshContext();
            const { verifyTask } = await import('./verification.ts');
            const { createVerifierSession, verifyWithSession } = await import('./verifier-agent.ts');
            verification = await verifyTask({ request: classificationRequest, plan, report: execution.report, before: context, after, tests }, {
              ask, signal: controller.signal, refreshDigest: () => refreshContext().digest,
              onDecision: (gate, approved) => {
                if (approved && recovery) assertRecoverySource(cwd, agentDir, recovery);
                journal?.record({ kind: 'verification-gate', gate, approved });
              },
              complete: async message => {
                const verifierModel = await selectModel(verifierConfig, modelRuntime);
                stderr.write(`Your Gear verifier: ${verifierModel.provider}/${verifierModel.id}\n`);
                const verifier = await createVerifierSession({ cwd, agentDir, modelRuntime, model: verifierModel });
                return verifyWithSession(verifier, message, controller.signal);
              },
            });
          } catch {
            verification = { status: controller.signal.aborted ? 'cancelled' : 'inconclusive', criteria: [],
              evidence: [], reason: 'No se pudo completar la verificación; los cambios previos pueden permanecer.' };
          }
        }
        if (verification) {
          journal?.record({ kind: 'verification', status: verification.status, supported: verification.criteria.filter(c => c.status === 'supported').length, total: plan.acceptanceCriteria.length });
          await state.memory?.checkpoint('verification','Resultado histórico de revisión: '+verification.status+'; criterios respaldados: '+verification.criteria.filter(c=>c.status==='supported').length+'/'+plan.acceptanceCriteria.length+'. No certifica el estado actual.');
          journal?.finish(verification.status);
        } else {
          journal?.finish(planDecision.status === 'cancelled' ? 'cancelled' : execution.status === 'awaiting-verification' ? 'failed' : execution.status);
        }
        stdout.write(JSON.stringify({ workflowId: journal?.id, assessment, decision, context: contextSummary, plan, planDecision, execution,
          tests: tests.map(({ path, status, exitCode, outputTruncated }) => ({ path, status, exitCode, outputTruncated })), verification }, null, 2) + '\n');
        if (controller.signal.aborted) process.exitCode = 130;
        else if (verification?.status !== 'accepted') process.exitCode = 1;
        return;
      }
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
const workflowState: { journal?: WorkflowJournal; memory?: WorkflowMemory } = {};
main(controller, workflowState).catch((error: unknown) => {
  try { workflowState.journal?.finish(controller.signal.aborted ? 'cancelled' : 'failed'); }
  catch { stderr.write('Your Gear: no se pudo cerrar el registro; revisar estado antes de retomar.\n'); }
  stderr.write(`Your Gear: ${redactError(error instanceof Error ? error.message : String(error))}\n`);
  process.exitCode = controller.signal.aborted ? 130 : 1;
}).finally(async () => {
  try { await workflowState.memory?.close(); }
  catch { stderr.write('Your Gear: no se pudo cerrar memoria.\n'); }
  process.off('SIGINT', onSigint);
  try { workflowState.journal?.close(); }
  catch { stderr.write('Your Gear: no se pudo cerrar el archivo de workflow.\n'); process.exitCode = 1; }
});
