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
- [ ] Ejecutar spike **integrado** Pi SDK; las 9 pruebas locales de la política ya pasaron (ver [resultado parcial](../spikes/pi-sdk-smoke.md)).
- [ ] Validar namespace y versiones concretas de dependencias del MVP.
- [ ] Decidir ADR-001 luego del spike; cerrar preguntas de ADR-003.
- [x] Agregar scaffolding TypeScript/Node, política inicial, pruebas locales y .gitignore.
- [x] Instalar dependencias, ejecutar typecheck y 17 tests en GitHub Actions con Node 22.19.0 (workflow verde, run 45097754213).
- [ ] Ejecutar smoke Pi SDK con un modelo real, validar aprobación/denegación, cancelación y Windows.
- [x] Agregar workflow CI mínimo y observar ejecución exitosa en GitHub Actions.
- [x] Ejecutar **17/17** pruebas locales de política, gate simulado y configuración (Node 22.16.0).
- [x] Validar `npm install`, `typecheck` y 17/17 tests en CI con Node 22.19.0 y el paquete SDK declarado.
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
- [Prueba manual Windows](../spikes/manual-smoke-windows.md)
- [Referencia complementaria: agent-harness-lab](https://github.com/lucasjaviluna/agent-harness-lab)

## Condiciones de cierre
- [ ] Elección del runtime sustentada en prueba real, no sólo lectura de docs.
- [ ] Se conoce cómo interceptar antes de cada herramienta sensible.
- [ ] Credenciales/planes soportados explícitos y sin riesgo de auth no autorizado.
- [ ] Estructura de código mínima permite iniciar Hito 1.
- [ ] ADR y roadmap actualizados según evidencia.

**Nota:** marcar documentación como entregada no equivale a validar el SDK ni completar el hito.

## Política de integración

Se puede fusionar la base documental y el scaffold con CI verde **sin** declarar Hito 0 terminado. Un merge de PR no implica aceptar ADR-001 ni garantizar seguridad de ejecución. Las pruebas manuales con un proveedor autorizado se documentan por separado.
