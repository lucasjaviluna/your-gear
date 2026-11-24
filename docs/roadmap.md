# Roadmap evolutivo — Your Gear

**Estado:** propuesto; reevaluar al cerrar cada hito.

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

## Hito 3 — Workflows con humanos en el circuito
Clasificación simple de tareas, plan opcional, gates por pasos, verificación de resultados y auditoría. Integración futura de especificaciones SDD, sin exigirlas a cada operación. Ver [diseño inicial](milestones/milestone-3.md); 3.A, 3.B, 3.C.1 y 3.C.2 integrados con CI exitoso; 3.C.3.A integrado con CI exitoso: executor experimental limitado a read/write/edit. 3.C.3.B integrado con CI exitoso: verificación de archivos seleccionados y pruebas Node explícitas, evaluación LLM y aceptación humana. 3.D.1 integrado con CI exitoso; 3.D.2 integrado con CI exitoso: recuperación guiada con nuevo UUID, vínculo al padre y aprobaciones nuevas, sin replay. Por decisión del usuario, adelantar memoria agéntica opcional: 3.D.3 puerto y adaptador YTK MCP; 3.D.4 checkpoints y recuperación asistida por referencias exactas; luego 3.E OpenSpec. [Aceptación manual del Hito 3](spikes/milestone-3-acceptance.md) pendiente. 3.E evaluará integración SDD opcional. Las pruebas manuales diferidas del Hito 2 no se declaran aprobadas; la ejecución experimental se limita a un workspace descartable hasta aceptación real.

## Hito 4 — Contexto y memoria opcional
Ampliar memoria agéntica opcional según casos reales e integrar una interfaz con RAG documental externo; no crear una base vectorial dentro del core. Políticas de contexto y minimización de información.

## Hito 5 — Robustez de producción
Instrumentación, recuperabilidad, compatibilidad, políticas avanzadas, documentación de contribución y releases; definir extensiones estables cuando haya consumidores reales.

## Regla de avance
No comenzar un hito por volumen de funciones: completar pruebas de aceptación del anterior o acordar y documentar explícitamente una desviación de alcance y sus límites. La prioridad puede cambiar según resultados del spike.
