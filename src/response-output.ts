/** Report Pi's streamed text and final provider status without duplicating output.
 * The SDK may resolve prompt() even when its completed assistant message says
 * stopReason=error. Keep diagnostics separate from the agent loop.
 */

type Assistant = {
  stopReason: string;
  errorMessage?: string;
  content: readonly { type: string; text?: string }[];
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Redact likely credentials and URLs from external error messages. Not a DLP guarantee. */
export function redactError(value: string): string {
  return value
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]')
    .replace(/\b(access_token|refresh_token|api[_-]?key|authorization|password)\s*[:=]\s*["']?[^"',\s}]+/gi, '$1=[REDACTED]')
    .replace(/https?:\/\/[^\s)]+/gi, '[URL REDACTED]')
    .slice(0, 700);
}

function parseAssistant(value: unknown): Assistant | undefined {
  if (!record(value) || value.role !== 'assistant' || typeof value.stopReason !== 'string') {
    return undefined;
  }
  const content = Array.isArray(value.content)
    ? value.content.filter((part): part is { type: string; text?: string } =>
        record(part) && typeof part.type === 'string')
    : [];
  return {
    stopReason: value.stopReason,
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : undefined,
    content,
  };
}

function finalText(assistant: Assistant | undefined): string {
  return assistant?.content.filter(part => part.type === 'text').map(part => part.text ?? '').join('') ?? '';
}

export function createResponseOutput(write: (text: string) => void) {
  let streamed = '';
  let assistant: Assistant | undefined;
  let aborted = false;

  return {
    onEvent(event: unknown): void {
      if (!record(event)) return;
      if (event.type === 'message_update' && record(event.assistantMessageEvent)) {
        const delta = event.assistantMessageEvent;
        if (delta.type === 'text_delta' && typeof delta.delta === 'string') {
          streamed += delta.delta;
          write(delta.delta);
        }
      } else if (event.type === 'message_end') {
        const parsed = parseAssistant(event.message);
        if (parsed) assistant = parsed;
      } else if (event.type === 'agent_settled' && event.aborted === true) {
        aborted = true;
      }
    },
    finish(fallbackText?: string): void {
      const text = finalText(assistant) || fallbackText || '';
      // The final message can arrive without any text_delta events. Recover it.
      if (text && !streamed) write(text);
      else if (text.startsWith(streamed) && text.length > streamed.length) write(text.slice(streamed.length));
      if (text || streamed) write('\n');

      if (aborted || assistant?.stopReason === 'aborted') {
        throw new Error('La ejecución fue cancelada.');
      }
      if (assistant?.stopReason === 'error') {
        const reason = assistant.errorMessage ? ` Detalle: ${redactError(assistant.errorMessage)}` : '';
        throw new Error(`El proveedor devolvió un error al generar la respuesta.${reason}`);
      }
      if (assistant?.stopReason === 'length') {
        throw new Error('El modelo alcanzó el límite de generación antes de finalizar.');
      }
      if (assistant?.stopReason === 'deferred') {
        throw new Error('El proveedor dejó la respuesta pendiente; el prototipo todavía no recupera respuestas diferidas.');
      }
      if (!text.trim() && !streamed.trim()) {
        const stop = assistant?.stopReason ?? 'sin mensaje de asistente';
        throw new Error(
          `Pi terminó sin contenido de texto (estado: ${stop}). ` +
          'Probá otro modelo de "node src/cli.ts models" o comprobá la autorización ChatGPT en Pi.',
        );
      }
    },
  };
}
