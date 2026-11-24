# ADR-002 — Modos de autenticación autorizados

**Estado:** Aceptado para el prototipo de Hito 0; inferencia real reportada en Windows.
**Actualización de alcance:** 2026-11-24 (PR #22). Las fuentes de política de proveedores corresponden a la evaluación original; revalidar antes de cambiar auth/SDK.

## Decisión

- **Predeterminado:** `pi-subscription`, exclusivamente `openai`, usando la implementación oficial **Sign in with ChatGPT** de Pi 1.6.0.
- Your Gear llama a `ModelRuntime.create()` con los defaults de Pi. **No lee, copia ni exporta** los tokens guardados por Pi, ni implementa un flujo OAuth propio.
- Para continuar, el runtime verifica `isUsingSubscription('openai')`; si no hay sesión de suscripción, **falla** con instrucciones para iniciar sesión en Pi.
- API key: solo con `YOUR_GEAR_AUTH_MODE=api-key` y `YOUR_GEAR_API_KEY`; sin fallback silencioso. Se usa un runtime separado bajo `~/.your-gear`.
- La selección de modelo en suscripción toma la intersección de `getAvailable('openai')` y los IDs del catálogo `openai-codex`; el usuario puede fijar `YOUR_GEAR_MODEL` o usar el primero. Es un filtro conservador, no una garantía de acceso de la cuenta.
- No se registran tokens, códigos ni API keys en archivos del proyecto; no imprimir el resultado bruto de auth.

## Configuración por rol (Hito 3)

Classifier, Planner, Executor y Verifier permiten modelos distintos pero comparten el proveedor efectivo y el modo de auth. Cada variable YOUR_GEAR_<ROL>_MODEL precede a YOUR_GEAR_MODEL, luego al modelo por rol en archivos (proyecto > usuario), modelo general de archivos y default. Si el proveedor de un rol difiere del efectivo, se rechaza. El comando models lista candidatos de suscripción; auth status indica detección de sesión, no prueba inferencia. Los comandos locales de journal/memoria no necesitan LLM. Ver [README](../../README.md).

## Fundamento

OpenAI documenta Sign in with ChatGPT para aplicaciones open-source/locales, con permiso explícito para usar el plan ChatGPT mediante la API pública Responses. Pi implementa este flujo en el proveedor `openai` y lo expone a su SDK. No hace falta fabricar un cliente OAuth adicional.

**No se reutiliza el proveedor `openai-codex`:** el modo que implementamos usa el proveedor `openai` y la autorización oficial de Responses. Que una suscripción esté configurada en Pi bajo otro proveedor no demuestra que esté disponible para `openai`.

## Claude y otros proveedores

Anthropic no autoriza integrar login Claude.ai ni encaminar credenciales Pro/Max mediante un harness de terceros. **Prohibido `anthropic` en modo `pi-subscription`**. El binario oficial Claude Code podría integrarse de forma separada bajo condiciones específicas; API keys Anthropic son otra vía explícita con facturación API.

GitHub Copilot, modelos locales y otros proveedores requieren evaluación técnica y contractual independiente antes de habilitarlos en el modo de suscripción. No afirmar soporte de suscripción por compartir nombre de proveedor.

## Riesgos y limitaciones

- Solo el propietario de la sesión de Pi puede autorizar la integración; debe tener una cuenta y permisos elegibles.
- `~/.pi/agent/auth.json` (o el directorio de configuración real de Pi) puede contener credenciales de otros proveedores; no usarlo como archivo de configuración editable de Your Gear.
- El orden de modelos de Pi puede variar. El CLI informa el modelo usado; se recomienda `YOUR_GEAR_MODEL` para reproducibilidad.
- El flujo depende de Pi y de cambios en las restricciones del proveedor. Revalidar al actualizar dependencias.
- El usuario reportó inferencia real con la sesión de Pi; la disponibilidad sigue dependiendo de la cuenta y del proveedor.

## Fuentes oficiales

- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt
- https://github.com/earendil-works/pi/blob/main/packages/ai/src/providers/openai.ts
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md
- https://code.claude.com/docs/en/legal-and-compliance
