# Roadmap evolutivo — Your Gear

**Estado al 2026-11-24:** implementación integrada hasta 3.D.4 (PR #22). El siguiente incremento es 3.E. Reevaluar aceptación y límites antes de ampliar capacidades.

CI de referencia: [PR #22, run 45504735165](https://github.com/lucasjaviluna/your-gear/actions/runs/45504735165), exitoso en Windows, Linux y macOS: typecheck, tests, build, pack, instalación y smoke del CLI. No incluye inferencia real ni binario YTK real.

## Hito 0 — Fundaciones (completado para el alcance validado)
Visión, ADR, opciones de stack, riesgos de auth, seguridad, spike SDK Pi y scaffold mínimo. Entrega: decisiones reproducibles y criterios de aceptación.

## Hito 1 — Vertical slice funcional (completado para el alcance validado)
CLI ejecutable localmente; configuración de un proveedor permitido; prompt con streaming; sesión persistida; herramientas read/write/shell con gate de aprobación; cancelar/reanudar; logs y tests. No TUI compleja todavía.

**Criterio de aceptación:** una persona resuelve una tarea sobre un workspace temporal, inspecciona y aprueba cambios, y puede continuar la sesión con trazabilidad básica.

**Persistencia y cancelación:** persistencia nativa de Pi optativa con `--persist` y reanudación de la más reciente con `--continue`. Tests locales ejercitan el almacenamiento real de Pi y el aislamiento por workspace. El usuario reportó que recuperó la palabra guardada tras cancelar una generación y, en otra prueba, un comando aprobado que esperaba antes de escribir: se mostró `La ejecución fue cancelada`, el archivo no apareció y la sesión se reanudó. Esto no garantiza cancelación de todos los procesos ni reversión de efectos ya ocurridos. La privacidad depende de permisos y ACL del sistema; quedan pendientes su verificación en instalaciones reales y la compatibilidad multiplataforma.

**Trazabilidad inicial:** el CLI muestra en stderr el modo de sesión, el resultado de cada solicitud de aprobación y eventos de solicitud, bloqueo y finalización para herramientas integradas, sin argumentos ni resultados en esa traza. El usuario reportó lectura y escritura exitosas dentro del workspace, bloqueo de operaciones sobre un archivo externo y visualización de los mensajes de solicitud y finalización. También comprobó los mensajes de sesión en memoria, persistente y reanudada, y los resultados de aprobación rechazada y concedida.

**Aceptación:** el usuario confirmó en Windows el flujo de lectura y edición en un workspace temporal, la inspección y aprobación del cambio, el resultado del archivo y la recuperación del contexto al continuar la sesión. La vista previa se integró mediante el PR #7. El detalle y los límites de la evidencia están en [Hito 1](milestones/milestone-1.md).

## Hito 2 — Extensiones y distribución (aceptación en progreso)
Skills y MCP bajo policy, configuración por usuario/proyecto, tests de herramientas, empaquetado `your-gear` con npm, docs de uso para Windows/macOS/Linux. TUI simple si mejora la UX sin acoplar al core.

**Estado:** incrementos 2.A–2.D integrados, CI multiplataforma exitoso. [Hito 2](milestones/milestone-2.md) y [matriz de aceptación](spikes/milestone-2-acceptance.md) registran los límites y las pruebas manuales pendientes.

## Hito 3 — Workflows con humanos en el circuito (implementado hasta 3.D.4; aceptación pendiente)

| Incremento | Entrega integrada | PR |
| --- | --- | --- |
| 3.A | Clasificador semántico LLM sin herramientas, sin fallback léxico | [#13](https://github.com/lucasjaviluna/your-gear/pull/13) |
| 3.B | Decisión humana de ruta, modelos por rol, evaluación sintética | [#14](https://github.com/lucasjaviluna/your-gear/pull/14) |
| 3.C.1 | Planner Agent y revisión de plan | [#15](https://github.com/lucasjaviluna/your-gear/pull/15) |
| 3.C.2 | Context Engine de lectura acotada | [#16](https://github.com/lucasjaviluna/your-gear/pull/16) |
| 3.C.3.A | Orquestador y executor read/write/edit | [#17](https://github.com/lucasjaviluna/your-gear/pull/17) |
| 3.C.3.B | Pruebas Node explícitas y verificación basada en evidencia | [#18](https://github.com/lucasjaviluna/your-gear/pull/18) |
| 3.D.1 | Journal local JSONL y consulta | [#19](https://github.com/lucasjaviluna/your-gear/pull/19) |
| 3.D.2 | Recuperación guiada con nuevo UUID y gates | [#20](https://github.com/lucasjaviluna/your-gear/pull/20) |
| 3.D.3 | MemoryProvider y adaptador YTK MCP opcional | [#21](https://github.com/lucasjaviluna/your-gear/pull/21) |
| 3.D.4 | Checkpoints opt-in y recuperación asistida por referencia exacta | [#22](https://github.com/lucasjaviluna/your-gear/pull/22) |
| 3.E | Evaluación e integración SDD/OpenSpec opcional | Pendiente |

Los PR #13–22 están integrados; el detalle de sus CI y alcance se conserva en [seguimiento del Hito 3](milestones/milestone-3.md). El modo directo permanece por defecto, la ruta task es optativa y experimental. Por decisión del usuario se adelantó memoria agéntica para recuperación antes de SDD ([ADR-004](adr/ADR-004-optional-agent-memory.md)); YTK no es obligatorio. OpenSpec todavía no se ejecuta.

**Pendientes antes de declarar aceptación:** [guía del Hito 2](spikes/milestone-2-acceptance.md), [guía del Hito 3](spikes/milestone-3-acceptance.md) (incluye recuperación con YTK), evaluación semántica con modelo real y smoke YTK real. La desviación acordada permite continuar incrementos acotados, no habilitar por defecto capacidades no validadas ni usar datos reales. No certificar seguridad de producción.

**Siguiente:** 3.E, comenzar por evaluación de necesidad y compatibilidad de OpenSpec y propuesta sin efectos automáticos. Mantener seguimiento explícito de la deuda de aceptación.

## Hito 4 — Contexto y memoria opcional
Ampliar memoria agéntica opcional según casos reales e integrar una interfaz con RAG documental externo; no crear una base vectorial dentro del core. Políticas de contexto y minimización de información.

## Hito 5 — Robustez de producción
Instrumentación, recuperabilidad, compatibilidad, políticas avanzadas, documentación de contribución y releases; definir extensiones estables cuando haya consumidores reales.

## Regla de avance
No comenzar un hito por volumen de funciones: completar pruebas de aceptación del anterior o acordar y documentar explícitamente una desviación de alcance y sus límites. La prioridad puede cambiar según resultados del spike.
