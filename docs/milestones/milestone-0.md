# Hito 0 — Fundamentos y arquitectura

**Estado:** COMPLETADO para el alcance validado · **Inicio:** 2026-11-22

## Evidencia

- El usuario informó que el PR #2 fue fusionado en `main` y que el login ChatGPT mediante Pi funciona.
- El usuario reportó 33 tests aprobados en CI y ocho pruebas manuales exitosas en Windows: lectura, escritura rechazada y aprobada, edición, shell, streaming, cancelación y errores del modelo.
- El usuario reportó que pasaron las comprobaciones manuales de bloqueo de rutas externas y de escritura sin TTY. No se registraron modelo, versión exacta de Node ni resultados individuales; ver [smoke Windows](../spikes/manual-smoke-windows.md).
- En la verificación local posterior pasaron 35 tests y typecheck. Las dos pruebas adicionales ejercitan el gate y la aprobación sin TTY mediante un proceso hijo; no son una prueba completa del SDK. No se afirmó CI de esa versión concreta en ese momento; esta es evidencia histórica, no el estado actual.
- Dependencia del prototipo: `@earendil-works/pi-coding-agent` 1.6.0; Node >=22.19.0.

## Decisiones y alcance

- [ADR-001: Pi SDK](../decisions/ADR-001-runtime.md) aceptado para el alcance validado; en Hito 0 quedaron pendientes reanudación y garantías para extensiones/MCP.
- [ADR-002: autenticación](../decisions/ADR-002-model-auth.md): suscripción OpenAI mediante Pi o API key con habilitación explícita.
- [ADR-003: extensibilidad](../decisions/ADR-003-extensibility.md): evolución progresiva, con gate comprobado antes de habilitar nuevas rutas de ejecución.
- En Hito 0 el CLI usaba sesiones en memoria. Hito 1 tenía como objetivo probar persistencia, reanudación, aislamiento por workspace, cancelación y privacidad.
- El prototipo no es un sandbox. Los riesgos y límites se detallan en [seguridad](../security.md). El smoke reportado es en Windows; no se afirma validación real en macOS ni Linux.

El cierre reconoce la evidencia disponible y sus límites; no certifica seguridad integral ni compatibilidad futura del SDK.

## Seguimiento posterior

El Hito 1 validó continuidad manual en Windows. Hitos 2 y 3 ampliaron el alcance con CI multiplataforma hasta PR #22; su aceptación real está pendiente. Ver [roadmap](../roadmap.md). Los resultados originales se conservan sin reinterpretarlos como pruebas de la versión actual.
