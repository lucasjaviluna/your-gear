# Arquitectura vigente — Your Gear

**Corte:** main tras PR #22 (2026-11-24). Hitos 0/1 aceptados para el alcance validado; 2.A–3.D.4 integrados y con CI exitoso, con aceptación real pendiente. Consultar [roadmap](roadmap.md) para el estado y [seguridad](security.md) para límites. Este documento distingue implementación de objetivos de evolución.

## Componentes implementados

```text
Usuario / terminal (CLI)
  |
  |-- Modo directo (prompt)
  |     Pi AgentSession -> read/write/edit/bash
  |     Skill explícita y MCP stdio opcional
  |     SessionManager -> memoria o JSONL de conversaciones
  |
  |-- Workflow optativo (--analyze-only / --review-route / --plan / --run-task)
  |     Classifier -> revisión de ruta -> Context Engine -> Planner
  |     -> revisión de plan -> inicio autorizado -> Executor
  |     -> pruebas Node seleccionadas -> Verifier -> revisión humana
  |     Workflow Journal JSONL (opt-in; obligatorio al recuperar)
  |     MemoryProvider -> adaptador YTK -> Pi MCP client -> proceso YTK
  |
  |-- Consulta / recuperación (--recover, workflows, workflow, memory)
  |     journal + checkpoints opcionales -> nuevo intento con gates
  |
  +-- Configuración, selección de modelo, auth Pi, policy, aprobación y cancelación
```

Pi SDK 1.6.0 proporciona runtime, eventos, herramientas, recursos y sesiones. `@earendil-works/pi-mcp` 1.6.0 proporciona el cliente stdio para memoria. Your Gear no es un fork, ni YTK es una dependencia obligatoria del proceso directo. No hay TUI, servidor web, motor declarativo genérico ni integración OpenSpec activa.

| Área | Implementación principal |
| --- | --- |
| Entrada, salida y coordinación | `src/cli.ts`, `src/response-output.ts`, `src/tool-trace.ts` |
| Configuración y auth | `config.ts`, `model-selection.ts`, ModelRuntime de Pi |
| Política de herramientas | `policy.ts`, `gate.ts`, `approval.ts` |
| Sesiones y extensibilidad directa | `sessions.ts`, `skills.ts`, `mcp.ts` |
| Clasificación y decisión de ruta | `assessment.ts`, `assessment-agent.ts`, `route-review.ts` |
| Contexto y planificación | `context-engine.ts`, `plan.ts`, `planner-agent.ts` |
| Ejecución de task | `task-orchestrator.ts`, `executor-agent.ts` |
| Evidencia y revisión | `verification-evidence.ts`, `verification.ts`, `verifier-agent.ts` |
| Persistencia y recuperación | `workflow-journal.ts`, `workflow-recovery.ts` |
| Memoria opcional | `memory/provider.ts`, `memory/config.ts`, `memory/ytk.ts`, `memory/checkpoint.ts`, `memory/workflow-memory.ts`, `memory/commands.ts` |

El CLI todavía coordina partes del workflow; no existe una API pública independiente de orquestación. El runtime usa directamente primitivas del SDK y helpers concretos (por ejemplo `tool-free-agent.ts`), no una capa universal de adaptadores.

## Modos de trabajo y fronteras

- **Directo:** comportamiento por defecto. Sesión Pi efímera, streaming, lectura dentro del workspace y gate de escritura/edición/shell. `--persist` y `--continue` conservan conversaciones, no estados globales del workflow. Una skill y un servidor MCP pueden seleccionarse explícitamente; no se cargan extensiones externas automáticamente.
- **Clasificación:** LLM sin herramientas, salida JSON validada; rutas simple/task/sdd/clarify. No regex, fallback léxico ni ejecución automática de la recomendación. `--review-route` permite decidir sin efectos. `--plan` solo planifica task. SDD todavía es una recomendación, no un ejecutor.
- **Task experimental:** requiere recomendación y selección task, aprobación de contexto y plan, y gate de inicio. Classifier, Planner, Executor y Verifier son sesiones independientes, no un sistema de delegación autónoma. El Context Engine lee hasta ocho archivos textuales (8000 bytes por archivo, 24000 bytes JSON), raíz conocida y selección explícita; no búsqueda recursiva ni RAG. Plan y entrada quedan ligados por hashes.
- **Executor:** solo read/write/edit, cada llamada con revisión humana, incluso read. Revalida política y snapshot antes de ejecutar; el alcance semántico depende del modelo y revisión humana. Sin shell, skills, extensiones MCP del modelo ni persistencia de conversaciones en task.
- **Verifier:** no tiene herramientas. El harness puede lanzar hasta tres archivos de prueba Node elegidos por el usuario, con autorización individual y límites. Una salida de proceso cero no demuestra cobertura. El LLM contrasta evidencia acotada y criterios; accepted exige pruebas seleccionadas con código cero, sin truncamiento ni errores/bloqueos del executor, criterios respaldados y revisión humana final. No es certificación del repositorio completo.
- **Recuperación:** solo registros sin cierre, por UUID; no demuestra que el proceso original esté detenido. Recuperación manual con trabajo restante o asistida por checkpoint, nuevo UUID, clasificación y planificación frescas, nuevas aprobaciones. Sin replay automático ni rollback. El estado terminal no se reactiva.

## Tres responsabilidades de persistencia

| Capa | Qué almacena | Activación |
| --- | --- | --- |
| Pi SessionManager | Conversaciones y resultados de tools del modo directo | --persist / --continue |
| Workflow Journal | Eventos, estados, decisiones, contadores, hashes y referencias de checkpoints | --record; --memory implica registro; recuperación crea otro |
| YTK externo | Resumen de plan aprobado, rutas, observaciones de ejecución/verificación | --memory, configuración de usuario y autorización explícita |

El journal reside en `~/.your-gear/workflows/<hash cwd canónico>/<uuid>.jsonl`; sesiones en `~/.your-gear/sessions/<hash cwd canónico>/`. El journal no almacena prompt, código o plan completo. Los checkpoints se guardan en la DB externa configurada; son evidencia histórica, no permisos. `MemoryProvider` aísla el contrato; YTK MCP se conecta por fuera del registro de herramientas de los modelos, y la sesión de memoria conserva su conexión. Referencias exactas por ID/digest/scope, no similitud. No hay transacción conjunta, lock global, cifrado ni garantía de idempotencia. Si falla memoria, la recuperación manual sigue disponible. El recall general entre tareas y RAG documental aún no están implementados.

## Configuración y autoridad

`~/.your-gear/config.json` y `.your-gear/config.json` definen modelos; entorno > proyecto > usuario (con prioridad por rol descrita en README). MCP y memoria usan únicamente registros del usuario `mcp.json` y `memory.json`. El segundo vincula un workspace canónico, ejecutable absoluto, proyecto, base existente y área opcional. Ningún dato de memoria, output o instrucción del proyecto concede permisos. Autenticación mediante Pi y modo API explícito según [ADR-002](decisions/ADR-002-model-auth.md).

## Evolución

Reutilizar SDK antes de abstraer. Mantener políticas fuera del LLM; validar nuevas vías de efectos y divulgación. El siguiente incremento es evaluar SDD/OpenSpec opcional (3.E), sin confundir integración con aceptación real. No introducir DI/event bus universal, colas, microservicios, marketplace ni una base vectorial propia sin caso comprobado. Ver [decisiones](decisions/ADR-001-runtime.md), [extensibilidad](decisions/ADR-003-extensibility.md), [memoria](adr/ADR-004-optional-agent-memory.md) y [referencias](references.md).
