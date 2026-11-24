import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const USAGE = 'Uso: your-gear [--persist|--continue] [--skill ruta/SKILL.md] [--mcp servidor] "tu instrucción" | your-gear --analyze-only "tu tarea" | your-gear --review-route "tu tarea" | your-gear --plan [--context archivo] "tu tarea" | your-gear --run-task [--record] [--context archivo] [--verify-test archivo] "tu tarea" | your-gear --recover ID [--context archivo] [--verify-test archivo] "trabajo pendiente" | your-gear memory status|list|search CONSULTA|get ID | your-gear workflows | your-gear workflow ID | your-gear auth status | your-gear models | your-gear --help | your-gear --version';

export type AuthMode = 'pi-subscription' | 'api-key';
export type Configuration = {
  prompt: string;
  provider: string;
  modelId?: string;
  authMode: AuthMode;
  apiKey?: string;
};

/**
 * Subscription is the default. API-key usage must be deliberately enabled;
 * don't silently fall back to a paid API when subscription auth is missing.
 */
type AgentSettings = { provider?: string; model?: string };
type FileSettings = { provider?: string; model?: string; agents?: { classifier?: AgentSettings; planner?: AgentSettings; executor?: AgentSettings; verifier?: AgentSettings } };

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readAgentSettings(value: unknown, path: string): NonNullable<FileSettings['agents']> {
  const invalid = () => new Error(`Opción de configuración inválida: agents (${path})`);
  if (!object(value) || !Object.keys(value).length) throw invalid();
  const agents: NonNullable<FileSettings['agents']> = {};
  for (const [role, entry] of Object.entries(value)) {
    if ((role !== 'classifier' && role !== 'planner' && role !== 'executor' && role !== 'verifier') || !object(entry) ||
      Object.keys(entry).some(key => key !== 'provider' && key !== 'model') ||
      !Object.values(entry).every(field => typeof field === 'string' && field.trim())) throw invalid();
    agents[role] = entry as AgentSettings;
  }
  return agents;
}

export function readSettings(cwd: string, agentDir: string): FileSettings {
  let result: FileSettings = {};
  for (const path of [join(agentDir, 'config.json'), join(cwd, '.your-gear', 'config.json')]) {
    let raw: string;
    try { raw = readFileSync(path, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw new Error(`No se pudo leer la configuración: ${path}`);
    }
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new Error(`Configuración JSON inválida: ${path}`); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Configuración inválida: ${path}`);
    const settings = value as Record<string, unknown>;
    for (const [key, entry] of Object.entries(settings)) {
      if (key === 'agents') {
        const agents = readAgentSettings(entry, path);
        result = { ...result, agents: {
          ...(result.agents?.classifier || agents.classifier ? { classifier: { ...result.agents?.classifier, ...agents.classifier } } : {}),
          ...(result.agents?.planner || agents.planner ? { planner: { ...result.agents?.planner, ...agents.planner } } : {}),
          ...(result.agents?.executor || agents.executor ? { executor: { ...result.agents?.executor, ...agents.executor } } : {}),
          ...(result.agents?.verifier || agents.verifier ? { verifier: { ...result.agents?.verifier, ...agents.verifier } } : {}),
        } };
        continue;
      }
      if (!['provider', 'model'].includes(key) || typeof entry !== 'string' || !entry.trim()) {
        throw new Error(`Opción de configuración inválida: ${key} (${path})`);
      }
    }
    const { agents: _agents, ...base } = settings;
    result = { ...result, ...base };
  }
  return result;
}

export function readConfiguration(args: readonly string[], env: NodeJS.ProcessEnv, settings: FileSettings = {}, role: 'default' | 'classifier' | 'planner' | 'executor' | 'verifier' = 'default'): Configuration {
  const prompt = args.join(' ').trim();
  if (!prompt || prompt === '--help' || prompt === '-h') {
    throw new Error(USAGE);
  }
  const authMode = env.YOUR_GEAR_AUTH_MODE?.trim() || 'pi-subscription';
  if (authMode !== 'pi-subscription' && authMode !== 'api-key') {
    throw new Error('YOUR_GEAR_AUTH_MODE debe ser pi-subscription o api-key.');
  }

  const provider = env.YOUR_GEAR_PROVIDER?.trim() || settings.provider?.trim() || 'openai';
  const agent = role === 'default' ? undefined : settings.agents?.[role];
  if (agent?.provider && agent.provider.trim() !== provider) {
    throw new Error('El agente debe usar el proveedor de autenticación configurado; no se reutilizan claves entre proveedores.');
  }
  const modelId = (role === 'classifier' ? env.YOUR_GEAR_CLASSIFIER_MODEL?.trim() : role === 'planner' ? env.YOUR_GEAR_PLANNER_MODEL?.trim() : role === 'executor' ? env.YOUR_GEAR_EXECUTOR_MODEL?.trim() : role === 'verifier' ? env.YOUR_GEAR_VERIFIER_MODEL?.trim() : undefined) ||
    env.YOUR_GEAR_MODEL?.trim() || agent?.model?.trim() || settings.model?.trim() || undefined;
  if (authMode === 'pi-subscription') {
    if (provider !== 'openai') {
      throw new Error('Por ahora, pi-subscription solo admite OpenAI / Sign in with ChatGPT. Claude OAuth no está autorizado en este harness.');
    }
    // Ignore any API key in this mode: explicit opt-in required for billed API usage.
    return { prompt, provider, modelId, authMode };
  }

  const apiKey = env.YOUR_GEAR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Para auth api-key, configurá YOUR_GEAR_API_KEY. No compartas ni registres su valor.');
  }
  return { prompt, provider, modelId, authMode, apiKey };
}
