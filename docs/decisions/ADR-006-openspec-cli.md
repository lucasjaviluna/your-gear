# ADR-006 — SDD opcional con OpenSpec mediante CLI acotada

**Estado:** propuesta técnica para 3.E.1 (2026-11-24). No habilita ejecución SDD. Revisión de compatibilidad real pendiente.

## Contexto y evidencia

El usuario aprobó SDD como estrategia opcional, no requisito general. Your Gear ya clasifica semánticamente simple/task/sdd/clarify; la ejecución task bloquea sdd. Consultamos OpenSpec [release v2.2.0](https://github.com/Fission-AI/OpenSpec/releases/tag/v2.2.0), publicada el 24 de noviembre de 2026 a las 19:55 UTC y reportada como latest por GitHub al momento de la revisión. Se revisaron [package.json](https://github.com/Fission-AI/OpenSpec/blob/v2.2.0/package.json), [contrato de agente](https://github.com/Fission-AI/OpenSpec/blob/v2.2.0/docs/agent-contract.md), [CLI](https://github.com/Fission-AI/OpenSpec/blob/v2.2.0/docs-lab/reference/cli.md) y [schema spec-driven](https://github.com/Fission-AI/OpenSpec/blob/v2.2.0/schemas/spec-driven/schema.yaml). Esto es inspección de fuentes fijadas a un tag, no prueba con binario instalado.

- OpenSpec ofrece CLI con salidas JSON y grafo de artefactos. El schema spec-driven usa proposal, specs, design y tasks. Los artefactos pueden quedar skipped; planning complete no significa implementación completa.
- La resolución de raíz puede elegir un store registrado, un puntero de proyecto, un ancestro o un default global. Los paths retornados y el contexto de proyecto no conceden autoridad para editar otros repositorios.
- La versión npm 2.2.0 requiere Node >=22.20.0; Your Gear usa >=22.19.0. El release ofrece ejecutables standalone para Windows/Linux/macOS. Evitamos elevar el mínimo del core o instalar dependencias por anticipado.

## Referencias de proyectos propios

[Your Harness v0, fase 6](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/PHASE_6_OPENSPEC.md) y [src/openspec.ts](https://github.com/lucasjaviluna/your-harness-v0/blob/main/src/openspec.ts) detectan prompts/skills Pi, delegan pasos OPSX y mantienen gates. Reutilizamos la separación de fases, no el descubrimiento por PATH ni la delegación de comandos de slash como autoridad. Your Gear es un CLI independiente y no carga recursos externos automáticamente.

[Agent Harness Lab, src/sdd.ts](https://github.com/lucasjaviluna/agent-harness-lab/blob/main/src/sdd.ts) demuestra CLI con argumentos fijos, JSON validado y snapshots/digests; su fixture está ligado a un change y schema concretos. Adoptamos el patrón de validación/consentimiento y no su clasificación léxica ni rutas fijas de ejemplo.

## Decisión propuesta

- OpenSpec conserva la semántica de sus artefactos y la validación de especificaciones; Your Gear conserva selección de estrategia, permisos, contexto, estados, gates, ejecución y verificación real. No recrear un parser SDD completo ni asumir que un slash command aplica políticas de Gear.
- Usar CLI externa instalada por el operador, argumentos cerrados, sin shell, sin npx/init/update automáticos. En 3.E.1 solo inventario de marcadores en cwd canónico y probe explícito de versión. La detección no activa nada ni consulta configuración global, stores, skills o padres. No se leen contenidos.
- El probe necesita TTY, path absoluto, preview y autorización. En Windows se selecciona .exe standalone (no shim .cmd); en Unix ejecutable directo. Resuelve path real y compara metadatos antes de iniciar; sigue habiendo TOCTOU. El proceso tiene permisos del usuario, puede heredar entorno y producir efectos; no es sandbox. Se solicitan flags de desactivación de telemetría/update, no se garantiza ausencia de red de un binario arbitrario. Timeout 10 s y buffer 8 KiB. Una versión reportada no certifica identidad, autenticidad o compatibilidad.
- Siguientes incrementos limitarán inicialmente la integración a un workspace repo-local explícito, schema spec-driven y change seleccionado. Los contratos JSON deben validar raíz real, IDs, artefactos, estado y límites antes de usar resultados. Stores, worksets, schemas personalizados, multi-repo y skip_specs se evalúan separadamente; no aceptar implícitamente roots externos, ni degradar tareas sdd a task.
- Antes de ejecutar cualquier comando distinto de --version se diseñará el gate correspondiente, se validará con release real y fixtures, y se revisará la semántica de efectos. No interpretar instrucciones de OpenSpec como autoridad. Mantener journal, memoria y telemetría independientes; un estado "done" de artefacto no sustituye verificación del código.

## Alternativas descartadas para 3.E.1

Importar OpenSpec como dependencia obligatoria; ejecutar npx o comandos PATH silenciosamente; cargar skills/prompts generados con permisos amplios; detectar un folder y afirmar readiness. No implementar stores/worksets sin caso y aislamiento.

## Secuencia de implementación

- **3.E.1:** diagnóstico local y probe explícito; no LLM, instalación ni mutaciones SDD.
- **3.E.2:** contrato y pruebas reales de lectura (list/status/instructions/validate), root repo-local verificado, versionado de compatibilidad, presupuestos y snapshots. Los comandos de terceros conservan gate de proceso.
- **3.E.3:** propuesta acotada y revisión humana de artefactos, vinculada a change y digest; sin apply automático.
- **3.E.4:** evaluar ejecución gobernada, verificación de producto, sync/archive separados con gates y reconciliación. No activar si los límites anteriores no están probados.

Los detalles posteriores son plan preliminar; no se elige todavía una API general de conectores. Ver [ADR-005](ADR-005-local-agentic-platform.md). La integración real, evaluación semántica y pruebas manuales de Hitos 2/3/YTK siguen pendientes.
