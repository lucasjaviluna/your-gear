export type Configuration = { prompt: string; provider: string; modelId: string; apiKey: string };

/** Deterministic validation; never include API-key values in thrown errors. */
export function readConfiguration(args: readonly string[], env: NodeJS.ProcessEnv): Configuration {
  const prompt = args.join(' ').trim();
  if (!prompt || prompt === '--help' || prompt === '-h') {
    throw new Error('Uso: your-gear "tu instrucción"');
  }
  const provider = env.YOUR_GEAR_PROVIDER?.trim();
  const modelId = env.YOUR_GEAR_MODEL?.trim();
  const apiKey = env.YOUR_GEAR_API_KEY?.trim();
  if (!provider || !modelId || !apiKey) {
    throw new Error('Faltan YOUR_GEAR_PROVIDER, YOUR_GEAR_MODEL o YOUR_GEAR_API_KEY. Usa una credencial autorizada.');
  }
  return { prompt, provider, modelId, apiKey };
}
