import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssistantMessageEventStream, type AssistantMessage, type Model } from '@earendil-works/pi-ai';
import { approveMcpStart, controlledMcpExtension, mcpToolNames, waitForMcpTools } from '../src/mcp.ts';
import { createToolCallHandler } from '../src/gate.ts';
import { createAgentSession, createMcpExtension, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';

test('MCP inicia la conexión al iniciar sesión, antes de cualquier tool_call', async t => {
  const cwd = mkdtempSync(join(tmpdir(), 'your-gear-mcp-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const agentDir = join(cwd, 'agent');
  const settingsManager = SettingsManager.inMemory();
  let toolCalls = 0;
  let attempted!: () => void;
  const connectionAttempted = new Promise<void>(resolve => { attempted = resolve; });
  const mcp = createMcpExtension({
    loadConfig: () => ({ errors: [], servers: [{ name: 'fixture', source: 'test',
      config: { command: 'fixture', exposure: 'direct' } }] }),
    createTransport: () => { attempted(); throw new Error('Conexión simulada'); },
    logPath: join(cwd, 'mcp.log'),
  });
  const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager, noExtensions: true,
    noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    extensionFactories: [mcp, pi => { pi.on('tool_call', async () => { toolCalls++; return { block: true }; }); }],
  });
  await loader.reload();
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json') });
  const { session } = await createAgentSession({ cwd, agentDir, settingsManager, modelRuntime: runtime,
    sessionManager: SessionManager.inMemory(cwd), resourceLoader: loader, tools: ['read', 'write', 'edit', 'bash'] });
  t.after(() => session.dispose());
  await session.bindExtensions({});
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([connectionAttempted, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error('No se observó el intento de conexión')), 5000);
    })]);
  } finally {
    clearTimeout(deadline);
  }
  assert.equal(toolCalls, 0);
});

test('servidor MCP local conecta, respeta el gate y cierra al terminar', async t => {
  const cwd = mkdtempSync(join(tmpdir(), 'your-gear-mcp-live-'));
  const marker = join(cwd, 'events.txt');
  const agentDir = join(cwd, 'agent');
  const settingsManager = SettingsManager.inMemory();
  const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'mcp-server.cjs');
  let allow = false;
  let intercepted = 0;
  const controller = new AbortController();
  const server = { name: 'fixture', command: process.execPath, args: [fixture, marker], tools: ['effect'] };
  await assert.rejects(approveMcpStart(server, cwd, async () => false), /no autorizado/);
  assert.equal(existsSync(marker), false);
  await approveMcpStart(server, cwd, async () => true);
  const names = mcpToolNames(server);
  const mcp = controlledMcpExtension(server, cwd);
  const authorize = createToolCallHandler(cwd, async () => allow, names, controller.signal);
  const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager, noExtensions: true, noSkills: true,
    noPromptTemplates: true, noThemes: true, noContextFiles: true, extensionFactories: [mcp, pi => {
      pi.on('tool_call', async event => {
        if (event.toolName === 'mcp__fixture__effect') intercepted++;
        return authorize(event);
      });
    }] });
  await loader.reload();
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json') });
  const model = { id: 'fake', name: 'fake', provider: 'openai', api: 'openai-completions', baseUrl: 'http://localhost', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 10000, maxTokens: 1000 } as Model<'openai-completions'>;
  const { session } = await createAgentSession({ cwd, agentDir, settingsManager, modelRuntime: runtime, model,
    sessionManager: SessionManager.inMemory(cwd), resourceLoader: loader, tools: names });
  t.after(async () => {
    await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
    session.dispose();
    rmSync(cwd, { recursive: true, force: true });
  });
  await session.bindExtensions({});
  await waitForMcpTools(names, () => session.agent.state.tools.map(tool => tool.name));
  const extraResults: { isError: boolean; result: unknown }[] = [];
  session.agent.subscribe(event => {
    if (event.type === 'tool_execution_end' && event.toolName === 'mcp__fixture__extra') {
      extraResults.push({ isError: event.isError, result: event.result });
    }
  });
  let turn = 0;
  let requested = 'mcp__fixture__effect';
  session.agent.streamFunction = () => {
    const stream = createAssistantMessageEventStream();
    const call = turn++ % 2 === 0;
    const message: AssistantMessage = { role: 'assistant', api: 'openai-completions', provider: 'openai', model: 'fake',
      content: call ? [{ type: 'toolCall', id: `call-${turn}`, name: requested, arguments: {} }] : [{ type: 'text', text: 'done' }],
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: call ? 'toolUse' : 'stop', timestamp: Date.now() };
    stream.push({ type: 'done', reason: call ? 'toolUse' : 'stop', message });
    return stream;
  };
  await session.agent.prompt('blocked');
  assert.equal(intercepted, 1);
  assert.doesNotMatch(readFileSync(marker, 'utf8'), /called/);
  allow = true;
  await session.agent.prompt('allowed');
  assert.equal(intercepted, 2);
  assert.match(readFileSync(marker, 'utf8'), /called/);
  requested = 'mcp__fixture__extra';
  await session.agent.prompt('extra is not authorized');
  assert.equal(extraResults.length, 1, 'la llamada simulada a extra debe llegar al runtime');
  assert.equal(extraResults[0].isError, true, 'extra debe ser rechazada');
  assert.match(JSON.stringify(extraResults[0].result), /not found|no autorizada/i);
  assert.deepEqual(await authorize({ toolName: requested, input: {} }), {
    block: true, reason: 'Herramienta no autorizada: mcp__fixture__extra',
  });
  assert.doesNotMatch(readFileSync(marker, 'utf8'), /tool:extra/);
  requested = 'mcp__fixture__effect';
  controller.abort();
  await session.agent.prompt('cancelled');
  assert.equal(readFileSync(marker, 'utf8').split('tool:effect').length - 1, 1);
  await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
  assert.match(readFileSync(marker, 'utf8'), /closed/);
});
