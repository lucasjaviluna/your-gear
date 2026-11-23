import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Type } from 'typebox';
import { createAssistantMessageEventStream, type AssistantMessage, type Model } from '@earendil-works/pi-ai';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { createToolCallHandler } from '../src/gate.ts';

test('el SDK aplica el gate a herramientas directas y llamadas anidadas', async t => {
  const cwd = mkdtempSync(join(tmpdir(), 'your-gear-sdk-gate-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const agentDir = join(cwd, 'agent');
  const settingsManager = SettingsManager.inMemory();
  const authorize = createToolCallHandler(cwd, async () => false);
  const calls: { name: string; parent?: string }[] = [];
  let effects = 0;
  let nestedError: boolean | undefined;
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager, noExtensions: true, noSkills: true,
    noPromptTemplates: true, noThemes: true, noContextFiles: true,
    extensionFactories: [pi => {
      pi.on('tool_call', async event => {
        calls.push({ name: event.toolName, parent: event.parentToolCallId });
        // The outer tool is allowed only in this experiment so it can request the nested call.
        if (event.toolName === 'outer') return undefined;
        return authorize(event);
      });
      pi.registerTool({ name: 'outer', label: 'outer', description: 'Nested call', parameters: Type.Object({}),
        async execute(_id, _args, _signal, _update, ctx) {
          const outcome = await ctx.executeTool('untrusted', {});
          nestedError = outcome.isError;
          return { content: [{ type: 'text', text: String(outcome.isError) }], details: {} };
        },
      });
      pi.registerTool({ name: 'untrusted', label: 'untrusted', description: 'Effect', parameters: Type.Object({}),
        async execute() { effects++; return { content: [{ type: 'text', text: 'executed' }], details: {} }; },
      });
    }],
  });
  await loader.reload();
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json') });
  const model = { id: 'fake', name: 'fake', provider: 'openai', api: 'openai-completions', baseUrl: 'http://localhost', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 10000, maxTokens: 1000 } as Model<'openai-completions'>;
  const { session } = await createAgentSession({ cwd, agentDir, settingsManager, modelRuntime: runtime, model,
    sessionManager: SessionManager.inMemory(cwd), resourceLoader: loader, tools: ['outer', 'untrusted'] });
  t.after(() => session.dispose());
  let turn = 0;
  session.agent.streamFunction = () => {
    const stream = createAssistantMessageEventStream();
    const content: AssistantMessage['content'] = turn++ === 0
      ? [{ type: 'toolCall', id: 'direct', name: 'untrusted', arguments: {} }, { type: 'toolCall', id: 'parent', name: 'outer', arguments: {} }]
      : [{ type: 'text', text: 'done' }];
    const message: AssistantMessage = { role: 'assistant', content, api: 'openai-completions', provider: 'openai', model: 'fake',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: turn === 1 ? 'toolUse' : 'stop', timestamp: Date.now() };
    stream.push({ type: 'done', reason: message.stopReason as 'stop' | 'toolUse', message });
    return stream;
  };
  await session.agent.prompt('test');
  assert.equal(effects, 0);
  assert.equal(nestedError, true);
  assert.ok(calls.some(call => call.name === 'untrusted' && !call.parent));
  assert.ok(calls.some(call => call.name === 'untrusted' && call.parent === 'parent'));
  assert.ok(calls.some(call => call.name === 'outer'));
});
