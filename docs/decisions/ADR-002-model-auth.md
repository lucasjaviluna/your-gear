# ADR-002 — Proveedores y autenticación

**Estado:** Aceptado como política base; conectores concretos pendientes
**Fecha:** 2026-11-22

## Decisión
- El usuario configura su proveedor y su mecanismo de autenticación **expresamente autorizado** por ese proveedor.
- API keys personales (BYOK), inferencia local y credenciales cloud admitidas son opciones base.
- No se promete que una suscripción de una aplicación equivalga a créditos API ni se eluden restricciones de terceros.
- No crear almacenamiento propio de OAuth si el SDK oficial proporciona uno seguro; no imprimir tokens.
- La disponibilidad técnica de login en una librería no demuestra permiso de uso contractual.

## Caso Claude / Anthropic
La documentación oficial indica que los desarrolladores de productos de terceros deben usar API keys o proveedores cloud soportados y no deben ofrecer login Claude.ai en sus propias apps ni encaminar credenciales Pro/Max de sus usuarios como medio de consumo. El uso del binario **Claude Code sin modificar** puede estar sujeto a una excepción separada y condiciones de distribución/autenticación: se evaluará como integración distinta y no como forma de compartir tokens con Pi o Your Gear.

Esto significa que **Your Gear con Pi SDK no debe ofrecer usar el plan Claude Pro/Max mediante OAuth de Claude**.

## Otros proveedores
OpenAI, GitHub Copilot y otros: validar expresamente términos y flujos autorizados por producto/plan antes de anunciar compatibilidad con suscripciones. El soporte de API keys no implica consumo de suscripción.

## Protección de secretos
- Priorizar variables de entorno/almacenes seguros cuando estén disponibles.
- `auth.json` y archivos equivalentes nunca se comitean ni se envían a logs.
- Redactar headers, env vars y argumentos sensibles.
- Denegar por defecto acceso de herramientas a rutas secretas.

## Fuentes (consultadas 2026-11-22)
- https://code.claude.com/docs/en/legal-and-compliance
- https://support.claude.com/en/articles/18467148-use-your-claude-platform-account-in-a-third-party-app
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md
