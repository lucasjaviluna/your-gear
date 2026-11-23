import type { Configuration } from './config.ts';

export type BasicModel = { id: string; provider: string };

/** Minimal Pi ModelRuntime contract. Keeps selection testable without live OAuth. */
export interface ModelCatalog<M extends BasicModel> {
  isUsingSubscription(provider: string): boolean;
  getAvailable(provider: string): Promise<readonly M[]>;
  getModel(provider: string, modelId: string): M | undefined;
  setRuntimeApiKey(provider: string, key: string): Promise<void>;
}

export async function selectModel<M extends BasicModel>(
  config: Configuration,
  runtime: ModelCatalog<M>,
): Promise<M> {
  if (config.authMode === 'pi-subscription' && !runtime.isUsingSubscription(config.provider)) {
    throw new Error(
      'No hay una sesión de suscripción ChatGPT activa en Pi para openai. Ejecutá pi, ' +
      'usá /login y elegí OpenAI → Sign in with ChatGPT; después repetí el comando. ' +
      'La sesión openai-codex es distinta de openai.',
    );
  }

  if (config.authMode === 'api-key') {
    if (!config.apiKey) throw new Error('Falta YOUR_GEAR_API_KEY para api-key.');
    await runtime.setRuntimeApiKey(config.provider, config.apiKey);
    if (config.modelId) {
      const model = runtime.getModel(config.provider, config.modelId);
      if (!model) throw new Error(`Modelo no encontrado: ${config.provider}/${config.modelId}`);
      return model;
    }
  }

  const available = await runtime.getAvailable(config.provider);
  const model = config.modelId
    ? available.find((candidate) => candidate.id === config.modelId)
    : available[0];
  if (!model) {
    throw new Error(
      config.modelId
        ? `Modelo ${config.provider}/${config.modelId} no disponible con la autenticación elegida. Ejecutá: your-gear models`
        : `No hay modelos disponibles para ${config.provider}. Consultá el login de Pi o indicá YOUR_GEAR_MODEL.`,
    );
  }
  return model;
}
