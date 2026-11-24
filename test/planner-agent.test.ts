import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssistantMessageEventStream, type AssistantMessage, type Model } from '@earendil-works/pi-ai';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { createPlannerSession, planWithSession } from '../src/planner-agent.ts';
import { isPlanApproved, reviewPlan } from '../src/plan.ts';

test('sesión planificadora real de Pi sin herramientas ni instrucciones del proyecto, modelo simulado', async t => {
  const cwd = mkdtempSync(join(tmpdir(), 'your-gear-classifier-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const agentDir = join(cwd, 'agent');
  mkdirSync(agentDir);
  writeFileSync(join(cwd, 'AGENTS.md'), 'UNTRUSTED_PROJECT_MARKER');
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json') });
  await modelRuntime.setRuntimeApiKey('openai', 'fixture-only');
  const model = { id: 'fake', name: 'fake', provider: 'openai', api: 'openai-completions', baseUrl: 'http://localhost', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 10000, maxTokens: 1000 } as Model<'openai-completions'>;
  const session = await createPlannerSession({ cwd, agentDir, modelRuntime, model });
  assert.equal(session.agent.state.tools.length, 0);
  assert.match(session.systemPrompt, /agente planificador/);
  assert.doesNotMatch(session.systemPrompt, /UNTRUSTED_PROJECT_MARKER/);
  let calls = 0;
  session.agent.streamFunction = () => {
    calls++;
    const stream = createAssistantMessageEventStream();
    const message: AssistantMessage = {
      role: 'assistant', api: 'openai-completions', provider: 'openai', model: 'fake',
      content: [{ type: 'text', text: JSON.stringify({ objective: 'Reintentos', scope: 'Una llamada', steps: ['Inspeccionar', 'Implementar'], acceptanceCriteria: ['Comprobar reintento'], risks: [], assumptions: [], unknowns: [] }) }],
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: 'stop', timestamp: Date.now(),
    };
    stream.push({ type: 'done', reason: 'stop', message });
    return stream;
  };
  const result = await planWithSession(session, 'Agregar reintentos', { recommendedRoute: 'task', source: 'llm', confidence: 'medium', reasons: ['Varios pasos'], affectedAreas: [], unknowns: [] }, new AbortController().signal);
  assert.equal(calls, 1);
  assert.equal(result.objective, 'Reintentos');
  assert.equal(isPlanApproved(result, await reviewPlan(result, async () => 's')), true);
});
