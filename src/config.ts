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
export function readConfiguration(args: readonly string[], env: NodeJS.ProcessEnv): Configuration {
  const prompt = args.join(' ').trim();
  if (!prompt || prompt === '--help' || prompt === '-h') {
    throw new Error('Uso: your-gear "tu instrucción" | your-gear auth status | your-gear models');
  }
  const authMode = env.YOUR_GEAR_AUTH_MODE?.trim() || 'pi-subscription';
  if (authMode !== 'pi-subscription' && authMode !== 'api-key') {
    throw new Error('YOUR_GEAR_AUTH_MODE debe ser pi-subscription o api-key.');
  }

  const provider = env.YOUR_GEAR_PROVIDER?.trim() || 'openai';
  const modelId = env.YOUR_GEAR_MODEL?.trim() || undefined;
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
