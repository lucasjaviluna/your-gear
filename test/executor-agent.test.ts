import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssistantMessageEventStream, type AssistantMessage, type Model } from '@earendil-works/pi-ai';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { createExecutorSession, executeWithSession } from '../src/executor-agent.ts';

for (const allowed of [true, false]) {
  test('executor Pi real, modelo simulado: escritura ' + (allowed ? 'aprobada' : 'rechazada'), async t => {
    const cwd = mkdtempSync(join(tmpdir(), 'gear-executor-'));
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    writeFileSync(join(cwd, 'AGENTS.md'), 'UNTRUSTED_PROJECT_MARKER');
    const agentDir = join(cwd, 'agent');
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json') });
    await runtime.setRuntimeApiKey('openai', 'fixture-only');
    const model = { id: 'fake', name: 'fake', provider: 'openai', api: 'openai-completions', baseUrl: 'http://localhost', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 10000, maxTokens: 1000 } as Model<'openai-completions'>;
    const controller = new AbortController();
    let approvals = 0;
    const executor = await createExecutorSession({ cwd, agentDir, modelRuntime: runtime, model }, async description => {
      approvals++;
      assert.match(description, /write:/);
      return allowed;
    }, controller.signal);
    assert.deepEqual(executor.session.agent.state.tools.map(x => x.name).sort(), ['edit', 'read', 'write']);
    assert.doesNotMatch(executor.session.systemPrompt, /UNTRUSTED_PROJECT_MARKER/);
    let turn = 0;
    executor.session.agent.streamFunction = () => {
      const stream = createAssistantMessageEventStream();
      const call = turn++ < (allowed ? 1 : 2);
      const message: AssistantMessage = { role: 'assistant', api: 'openai-completions', provider: 'openai', model: 'fake',
        content: call ? [{ type: 'toolCall', id: 'write-' + turn, name: 'write', arguments: { path: 'result.txt', content: 'fixture' } }] : [{ type: 'text', text: 'Reporte del modelo' }],
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: call ? 'toolUse' : 'stop', timestamp: Date.now() };
      stream.push({ type: 'done', reason: call ? 'toolUse' : 'stop', message });
      return stream;
    };
    const report = await executeWithSession(executor, 'fixture', controller.signal);
    assert.equal(approvals, 1);
    assert.equal(existsSync(join(cwd, 'result.txt')), allowed);
    if (allowed) {
      assert.equal(readFileSync(join(cwd, 'result.txt'), 'utf8'), 'fixture');
      assert.equal(report.blockedCalls, 0);
      assert.equal(report.toolErrors, 0);
    } else {
      assert.ok(report.blockedCalls >= 1);
    }
    assert.equal(report.summary, 'Reporte del modelo');
  });
}
