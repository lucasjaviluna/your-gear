import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { createResponseOutput } from './response-output.ts';

type Options = NonNullable<Parameters<typeof createAgentSession>[0]>;

/** Separate, ephemeral reasoning session; no project resources or executable tools. */
export async function createToolFreeSession(options: Pick<Options, 'cwd' | 'agentDir' | 'modelRuntime' | 'model'> & { cwd: string; agentDir: string }, systemPrompt: string) {
  const { cwd, agentDir } = options;
  const settingsManager = SettingsManager.inMemory({ defaultTools: [] });
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager, systemPrompt,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    extensionFactories: [pi => { pi.on('tool_call', async () => ({ block: true, reason: 'El agente no puede usar herramientas.' })); }],
  });
  await loader.reload();
  const { session, extensionsResult } = await createAgentSession({
    ...options, settingsManager, resourceLoader: loader, sessionManager: SessionManager.inMemory(cwd), tools: [],
  });
  if (extensionsResult.errors.length || session.agent.state.tools.length) {
    session.dispose();
    throw new Error('No se pudo inicializar el agente sin herramientas.');
  }
  return session;
}

export async function runToolFreeSession<T>(session: Awaited<ReturnType<typeof createToolFreeSession>>, run: (complete: (message: string) => Promise<string>) => Promise<T>, signal: AbortSignal) {
  const output = createResponseOutput(() => {});
  const unsubscribe = session.subscribe(event => output.onEvent(event));
  const abort = () => { void session.abort().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    return await run(async message => {
      if (session.agent.state.tools.length) throw new Error('El agente no puede usar herramientas.');
      await session.prompt(message);
      const text = session.getLastAssistantText();
      output.finish(text);
      return text ?? '';
    });
  } finally {
    signal.removeEventListener('abort', abort);
    unsubscribe();
    session.dispose();
  }
}
