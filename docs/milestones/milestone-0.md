# Hito 0 — Fundamentos y arquitectura

**Estado:** EN PROGRESO · **Inicio:** 2026-11-22
**Objetivo:** tomar decisiones mínimas fundamentadas y dejar un camino ejecutable hacia el MVP.

## Avance
- [x] Crear el repositorio oficial `lucasjaviluna/your-gear` (rama `main`).
- [x] Establecer visión, principios, alcance y no-objetivos iniciales.
- [x] Evaluar TypeScript/Node vs Go/Rust a nivel de arquitectura.
- [x] Documentar alternativas para runtime y seleccionar Pi SDK para el *primer spike*.
- [x] Identificar políticas de autenticación y restricciones de suscripción Claude.
- [x] Plantear arquitectura modular y límites de seguridad.
- [ ] Ejecutar spike Pi SDK, con pruebas de gate y sesiones (ver [spike](../spikes/pi-sdk.md)).
- [ ] Validar namespace y versiones concretas de dependencias del MVP.
- [ ] Decidir ADR-001 luego del spike; cerrar preguntas de ADR-003.
- [ ] Crear scaffolding TypeScript/Node, lint/test base, .gitignore, CI mínima si el spike lo avala.
- [ ] Verificar los criterios y declarar Hito 0 completado.

## Entregables
- [Visión](../vision.md)
- [Arquitectura candidata](../architecture.md)
- [Evaluación tecnológica](../tech-stack.md)
- [ADR-001: runtime](../decisions/ADR-001-runtime.md)
- [ADR-002: auth](../decisions/ADR-002-model-auth.md)
- [ADR-003: extensibilidad](../decisions/ADR-003-extensibility.md)
- [Seguridad](../security.md)
- [Roadmap](../roadmap.md)
- [Spike reproducible](../spikes/pi-sdk.md)

## Condiciones de cierre
- [ ] Elección del runtime sustentada en prueba real, no sólo lectura de docs.
- [ ] Se conoce cómo interceptar antes de cada herramienta sensible.
- [ ] Credenciales/planes soportados explícitos y sin riesgo de auth no autorizado.
- [ ] Estructura de código mínima permite iniciar Hito 1.
- [ ] ADR y roadmap actualizados según evidencia.

**Nota:** marcar documentación como entregada no equivale a validar el SDK ni completar el hito.
