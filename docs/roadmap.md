# Roadmap evolutivo — Your Gear

**Estado al 2026-11-25:** implementación integrada hasta 3.E.3 (PR #27) y estabilización 3.C.3.C (PR #28). OpenSpec permite inspección y revisión experimental de artefactos seleccionados; la integración SDD con planificación y ejecución sigue pendiente. La aceptación real del Hito 3 también sigue pendiente.

CI de implementación de referencia: [PR #28, run 45735634433](https://github.com/lucasjaviluna/your-gear/actions/runs/45735634433), exitoso en Windows, Linux y macOS: typecheck, tests, build, pack, instalación y smoke del CLI. No incluye inferencia real ni binario YTK real. El [CI del PR #23 documental](https://github.com/lucasjaviluna/your-gear/actions/runs/45506701591) también finalizó correctamente; se encuentra mergeado.

## Hito 0 — Fundaciones (completado para el alcance validado)
Visión, ADR, opciones de stack, riesgos de auth, seguridad, spike SDK Pi y scaffold mínimo. Entrega: decisiones reproducibles y criterios de aceptación.

## Hito 1 — Vertical slice funcional (completado para el alcance validado)
CLI ejecutable localmente; configuración de un proveedor permitido; prompt con streaming; sesión persistida; herramientas read/write/shell con gate de aprobación; cancelar/reanudar; logs y tests. No TUI compleja todavía.

**Criterio de aceptación:** una persona resuelve una tarea sobre un workspace temporal, inspecciona y aprueba cambios, y puede continuar la sesión con trazabilidad básica.

**Persistencia y cancelación:** persistencia nativa de Pi optativa con `--persist` y reanudación de la más reciente con `--continue`. Tests locales ejercitan el almacenamiento real de Pi y el aislamiento por workspace. El usuario reportó que recuperó la palabra guardada tras cancelar una generación y, en otra prueba, un comando aprobado que esperaba antes de escribir: se mostró `La ejecución fue cancelada`, el archivo no apareció y la sesión se reanudó. Esto no garantiza cancelación de todos los procesos ni reversión de efectos ya ocurridos. La privacidad depende de permisos y ACL del sistema; quedan pendientes su verificación en instalaciones reales y la compatibilidad multiplataforma.

**Trazabilidad inicial:** el CLI muestra en stderr el modo de sesión, el resultado de cada solicitud de aprobación y eventos de solicitud, bloqueo y finalización para herramientas integradas, sin argumentos ni resultados en esa traza. El usuario reportó lectura y escritura exitosas dentro del workspace, bloqueo de operaciones sobre un archivo externo y visualización de los mensajes de solicitud y finalización. También comprobó los mensajes de sesión en memoria, persistente y reanudada, y los resultados de aprobación rechazada y concedida.

**Aceptación:** el usuario confirmó en Windows el flujo de lectura y edición en un workspace temporal, la inspección y aprobación del cambio, el resultado del archivo y la recuperación del contexto al continuar la sesión. La vista previa se integró mediante el PR #7. El detalle y los límites de la evidencia están en [Hito 1](milestones/milestone-1.md).

## Hito 2 — Extensiones y distribución (aceptado para el alcance validado)
Skills y MCP bajo policy, configuración por usuario/proyecto, tests de herramientas, empaquetado `your-gear` con npm, docs de uso para Windows/macOS/Linux. TUI simple si mejora la UX sin acoplar al core.

**Estado:** incrementos 2.A–2.D integrados, CI multiplataforma exitoso y aceptación Windows para el alcance registrado. [Hito 2](milestones/milestone-2.md) y [matriz de aceptación](spikes/milestone-2-acceptance.md) detallan evidencia real y simulada y sus límites.

## Hito 3 — Workflows con humanos en el circuito (implementado hasta 3.D.4; aceptación pendiente)

| Incremento | Entrega integrada | PR |
| --- | --- | --- |
| 3.A | Clasificador semántico LLM sin herramientas, sin fallback léxico | [#13](https://github.com/lucasjaviluna/your-gear/pull/13) |
| 3.B | Decisión humana de ruta, modelos por rol, evaluación sintética | [#14](https://github.com/lucasjaviluna/your-gear/pull/14) |
| 3.C.1 | Planner Agent y revisión de plan | [#15](https://github.com/lucasjaviluna/your-gear/pull/15) |
| 3.C.2 | Context Engine de lectura acotada | [#16](https://github.com/lucasjaviluna/your-gear/pull/16) |
| 3.C.3.A | Orquestador y executor read/write/edit | [#17](https://github.com/lucasjaviluna/your-gear/pull/17) |
| 3.C.3.B | Pruebas Node explícitas y verificación basada en evidencia | [#18](https://github.com/lucasjaviluna/your-gear/pull/18) |
| 3.C.3.C | Contrato verificable entre planificación, ejecución y evidencia | [#28](https://github.com/lucasjaviluna/your-gear/pull/28); CI exitoso, aceptación real pendiente |
| 3.D.1 | Journal local JSONL y consulta | [#19](https://github.com/lucasjaviluna/your-gear/pull/19) |
| 3.D.2 | Recuperación guiada con nuevo UUID y gates | [#20](https://github.com/lucasjaviluna/your-gear/pull/20) |
| 3.D.3 | MemoryProvider y adaptador YTK MCP opcional | [#21](https://github.com/lucasjaviluna/your-gear/pull/21) |
| 3.D.4 | Checkpoints opt-in y recuperación asistida por referencia exacta | [#22](https://github.com/lucasjaviluna/your-gear/pull/22) |
| 3.E.1 | Evaluación y decisión de proveedor OpenSpec opcional | Integrado; [ADR-006](decisions/ADR-006-optional-openspec.md) |
| 3.E.2 | Inspección estructural de change existente | Integrado experimentalmente en PR #26 |
| 3.E.3 | Revisión explícita de artefactos OpenSpec | Integrado experimentalmente en [PR #27](https://github.com/lucasjaviluna/your-gear/pull/27) |
| 3.E.4 | Planificación y aplicación SDD con gates propios | Pendiente; no hay workflow ejecutable |

Los PR #13–24 y #26–28 están integrados; #25 se cerró sin merge por quedar reemplazado por #26/#27. el detalle de su CI y alcance se conserva en [seguimiento del Hito 3](milestones/milestone-3.md). El modo directo permanece por defecto, la ruta task es optativa y experimental. Por decisión del usuario se adelantó memoria agéntica para recuperación antes de SDD ([ADR-004](adr/ADR-004-optional-agent-memory.md)); YTK no es obligatorio. OpenSpec permite inspección estructural y revisión explícita, ambas experimentales; revisión no llama modelos, no persiste aprobación y no ejecuta cambios. No hay planificación ni aplicación SDD ejecutable.

**Pendientes antes de declarar aceptación del Hito 3:** [guía del Hito 3](spikes/milestone-3-acceptance.md) (incluye recuperación con YTK), ampliación de la evaluación semántica (12/12 casos iniciales aprobados) y aceptación integral YTK (smoke aprobado con binario compilado que incluye memory_list, no con release 0.1.12). La desviación acordada permite continuar incrementos acotados, no habilitar por defecto capacidades no validadas ni usar datos reales. No certificar seguridad de producción.

**Siguiente:** prueba integral automatizada de task y recuperación (3.C.3.C/3.D.4), luego aceptación real con modelo y binario YTK compatible y continuar 3.E.4, definir un contrato SDD que enlace artefactos revisados y su digest al plan y al ejecutor, con gates explícitos de divulgación, aprobación y cada efecto. Mantener la alternativa OpenSpec opcional, validar el workflow con pruebas y conservar seguimiento explícito de la deuda de aceptación.

## Hitos 4–10 — Evolución de producto acordada

La visión de largo plazo fue aprobada por el usuario el 2026-11-24. Los Hitos 0–3 conservan su numeración, implementación y evidencia. Los antiguos Hitos 4 (contexto/memoria) y 5 (producción) se amplían y redistribuyen: contexto/memoria pasa a Hito 7; producción se consolida en Hito 10. Los números nuevos son el plan vigente, no avances ejecutados. Ver [visión](vision.md), [arquitectura objetivo](target-architecture.md) y [ADR-005](decisions/ADR-005-local-agentic-platform.md).

| Hito | Objetivo | Estado |
| --- | --- | --- |
| 4 | Unified Request Management | Pendiente |
| 5 | Connector Management | Pendiente |
| 6 | Reliability & Resilience | Pendiente |
| 7 | Advanced Context & Memory | Pendiente |
| 8 | Telemetry & Observability | Pendiente |
| 9 | Developer Experience & TUI | Pendiente |
| 10 | Production Readiness | Pendiente |

Los siguientes cortes son una descomposición inicial de la visión acordada. El alcance exacto y las pruebas se detallarán antes de implementar cada uno; no implican una API, dependencia o biblioteca elegida.

### Hito 4 — Unified Request Management

**Objetivo:** que el desarrollador envíe una solicitud y el harness coordine la estrategia apropiada, sin necesidad de conocer los comandos de cada agente.

- 4.A: límite de aplicación reutilizable, contrato mínimo de solicitud/resultado e identidad correlacionable con workflow/intento. Extraer coordinación de cli.ts solo donde sea necesaria.
- 4.B: entrada unificada y selección semántica de direct/simple, task, SDD opcional o clarify; rutas explícitas para diagnóstico y automatización.
- 4.C: lifecycle de solicitud, resultados parciales, cancelación y recuperación enlazada; sesiones interactivas básicas si aportan valor sin anticipar la TUI.

**Criterio:** una solicitud simple, una task y una SDD habilitada usan la misma entrada y conservan políticas, gates y resultados explícitos. La aclaración o ausencia de capacidad requerida no ejecuta efectos. El CLI directo y las rutas actuales mantienen sus pruebas de regresión. No introducir automáticamente fuentes externas de requests; evaluarlas según caso real.

### Hito 5 — Connector Management

**Objetivo:** habilitar y deshabilitar integraciones sin acoplar el núcleo a sus implementaciones.

- 5.A: resolución y validación de configuración, procedencia/confianza, scopes, capacidades requeridas y opcionales.
- 5.B: lifecycle, disponibilidad, diagnóstico y cierre coherentes de memoria, MCP y SDD según sus contratos; skills conservan su mecanismo propio. Reutilizar MemoryProvider y cliente Pi MCP.
- 5.C: pruebas de compatibilidad, desactivación, fallo parcial y políticas de acceso; extensiones adicionales solo ante casos concretos.

**Criterio:** los conectores deshabilitados no arrancan; el core resuelve una tarea que no depende de ellos. Si se requiere un conector ausente, se bloquea o acuerda alternativa. Los procesos, permisos y scopes se verifican antes de efectos y no se recuperan desde memoria. No crear una API universal de plugins por anticipado.

### Hito 6 — Reliability & Resilience

**Objetivo:** fallos controlados, reintentos seguros y recuperación confiable, sin duplicar efectos.

- 6.A: taxonomía de errores, resultados accionables, límites de tiempo e intentos, cancelación propagada.
- 6.B: políticas por operación, backoff/jitter, límites de consumo y coordinación con retries del SDK; rechazos y auth inválida no se reintentan.
- 6.C: reconciliación de efectos inciertos, checkpoints y recuperación asistida robustecidos, concurrencia/exclusión del workspace evaluada con pruebas de interrupción y fallos.

**Criterio:** pruebas deterministas demuestran límites ante fallos transitorios, no repetición ciega de escrituras/efectos inciertos, cancelación y gates renovados. Escenarios de caída, recuperación y recursos externos verifican estados conocidos e inciertos sin prometer exactly-once ni rollback universal.

### Hito 7 — Advanced Context & Memory

**Objetivo:** conocimiento técnico reutilizable entre tareas, presupuestos de contexto y RAG documental desacoplado.

- 7.A: bootstrap de memoria relevante, decisiones/hallazgos curados, recuperación por proyecto y reglas de minimización.
- 7.B: selección y evaluación de contexto, procedencia, vigencia, deduplicación y límites; recall como evidencia no confiable, no autoridad.
- 7.C: conector RAG externo opcional, basado en caso real; no crear índice vectorial propio en el core.

**Criterio:** tarea real usa contexto autorizado y trazable, con comparativa de calidad y consumo frente a baseline sin memoria. Desactivación o fallo no rompe flujos independientes; no se filtran scopes ni se restauran permisos. Validar memoria real, no solo fixture.

### Hito 8 — Telemetry & Observability

**Objetivo:** entender consumo, rendimiento, resultados y fallos sin exponer datos sensibles.

- 8.A: contrato de eventos correlacionados, schema, tiempos, resultados y categorías de error.
- 8.B: métricas de modelos, agentes, workflows, tools, conectores, gates y retries; usage medido frente a estimado/desconocido, sin doble conteo ni coste API ficticio para suscripciones.
- 8.C: consultas/reportes locales, límites y retención, exportadores opt-in; evaluar OpenTelemetry/OTLP y Grafana si hay caso comprobado.

**Criterio:** correlacionar ejecución completa y recuperación; contrastar tokens con metadata real del SDK cuando exista; comprobar que no se registran deliberadamente prompts, código o secretos por defecto, y que fallo/desactivación de telemetría no altera autoridad ni aceptación. Exportación externa explícita y verificable.

### Hito 9 — Developer Experience & TUI

**Objetivo:** experiencia amigable y usable para instalación, configuración, trabajo interactivo y recuperación.

- 9.A: setup/doctor, diagnósticos, selección de modelos y conectores; revisión de experiencia de CLI.
- 9.B: prototipo TUI y elección de librería con evidencia de terminales objetivo. Consumir el límite de aplicación y eventos; no duplicar políticas.
- 9.C: vistas de progreso, planes, aprobaciones, errores, consumo y tareas recuperables; pruebas de teclado, redimensionado, terminales y cancelación.

**Criterio:** desarrollador configura y realiza/recupera una tarea mediante una sesión amigable, sin aprender comandos internos; las mismas políticas rigen CLI/TUI y no hay bypass headless. Validar usabilidad y compatibilidad con personas y terminales reales.

### Hito 10 — Production Readiness

**Objetivo:** distribución instalable por cada desarrollador, mantenimiento y operación confiable.

- 10.A: versionado, licencias, canal de distribución npm, releases reproducibles, instalación/actualización/rollback y documentación.
- 10.B: hardening de seguridad, aislamiento y concurrencia según amenazas, control de datos/retención, compatibilidad de dependencias.
- 10.C: aceptación end-to-end y piloto con desarrolladores, plataformas y conectores reales; rendimiento, soporte y criterios de release.

**Criterio:** instalación y actualización verificadas, evidencia de aceptación real, límites de seguridad explícitos, recuperación y observabilidad probadas, guía de operación y soporte. No declarar producción por el éxito del CI ni publicar sin decisión de release.

## Regla de avance y trabajo transversal

El próximo incremento sigue siendo **3.E — evaluación e integración opcional de SDD/OpenSpec**. No iniciar Hito 4 ni renumerar Hitos 0–3 como consecuencia de esta actualización documental.

Reliability, seguridad, observabilidad y UX son responsabilidades transversales: incorporar lo mínimo necesario en cada cambio desde ahora; los hitos 6/8/9 consolidan esas capacidades, no retrasan controles necesarios. No comenzar un hito por volumen de funciones: completar aceptación anterior o acordar y documentar una desviación explícita, sus límites y deuda. La prioridad puede cambiar por evidencia; registrar decisiones y actualizar visión/arquitectura/roadmap cuando corresponda. Mantener tareas pequeñas, tests, CI y revisión humana antes de merge.
