import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { assessTask, CLASSIFIER_SYSTEM_PROMPT } from './assessment.ts';
import { createResponseOutput } from './response-output.ts';

type Options = NonNullable<Parameters<typeof createAgentSession>[0]>;

/** Separate, ephemeral classifier session; no project resources or executable tools. */
export async function createClassifierSession(options: Pick<Options, 'cwd' | 'agentDir' | 'modelRuntime' | 'model'> & { cwd: string; agentDir: string }) {
  const { cwd, agentDir } = options;
  const settingsManager = SettingsManager.inMemory({ defaultTools: [] });
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager, systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    extensionFactories: [pi => { pi.on('tool_call', async () => ({ block: true, reason: 'El clasificador no puede usar herramientas.' })); }],
  });
  await loader.reload();
  const { session, extensionsResult } = await createAgentSession({
    ...options, settingsManager, resourceLoader: loader, sessionManager: SessionManager.inMemory(cwd), tools: [],
  });
  if (extensionsResult.errors.length || session.agent.state.tools.length) {
    session.dispose();
    throw new Error('No se pudo inicializar el clasificador sin herramientas.');
  }
  return session;
}

export async function classifyWithSession(session: Awaited<ReturnType<typeof createClassifierSession>>, prompt: string, signal: AbortSignal) {
  const output = createResponseOutput(() => {});
  const unsubscribe = session.subscribe(event => output.onEvent(event));
  const abort = () => { void session.abort().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    return await assessTask(prompt, async message => {
      if (session.agent.state.tools.length) throw new Error('El clasificador no puede usar herramientas.');
      await session.prompt(message);
      const text = session.getLastAssistantText();
      output.finish(text);
      return text ?? '';
    }, signal);
  } finally {
    signal.removeEventListener('abort', abort);
    unsubscribe();
    session.dispose();
  }
}
