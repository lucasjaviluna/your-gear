import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssistantMessageEventStream, type AssistantMessage, type Model } from '@earendil-works/pi-ai';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { classifyWithSession, createClassifierSession } from '../src/assessment-agent.ts';

test('sesión clasificadora real de Pi sin herramientas ni instrucciones del proyecto, modelo simulado', async t => {
  const cwd = mkdtempSync(join(tmpdir(), 'your-gear-classifier-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const agentDir = join(cwd, 'agent');
  mkdirSync(agentDir);
  writeFileSync(join(cwd, 'AGENTS.md'), 'UNTRUSTED_PROJECT_MARKER');
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json') });
  await modelRuntime.setRuntimeApiKey('openai', 'fixture-only');
  const model = { id: 'fake', name: 'fake', provider: 'openai', api: 'openai-completions', baseUrl: 'http://localhost', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 10000, maxTokens: 1000 } as Model<'openai-completions'>;
  const session = await createClassifierSession({ cwd, agentDir, modelRuntime, model });
  assert.equal(session.agent.state.tools.length, 0);
  assert.match(session.systemPrompt, /clasificador de solicitudes/);
  assert.doesNotMatch(session.systemPrompt, /UNTRUSTED_PROJECT_MARKER/);
  let calls = 0;
  session.agent.streamFunction = () => {
    calls++;
    const stream = createAssistantMessageEventStream();
    const message: AssistantMessage = {
      role: 'assistant', api: 'openai-completions', provider: 'openai', model: 'fake',
      content: [{ type: 'text', text: JSON.stringify({ recommendedRoute: 'sdd', confidence: 'medium', reasons: ['Impacto transversal'], affectedAreas: ['access'], unknowns: [] }) }],
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: 'stop', timestamp: Date.now(),
    };
    stream.push({ type: 'done', reason: 'stop', message });
    return stream;
  };
  const result = await classifyWithSession(session, 'Permitir acceso a todas las pantallas.', new AbortController().signal);
  assert.equal(calls, 1);
  assert.equal(result.recommendedRoute, 'sdd');
  assert.equal(result.source, 'llm');
});
