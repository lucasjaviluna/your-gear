# Roadmap evolutivo — Your Gear

**Estado:** propuesto; reevaluar al cerrar cada hito.

## Hito 0 — Fundaciones (completado para el alcance validado)
Visión, ADR, opciones de stack, riesgos de auth, seguridad, spike SDK Pi y scaffold mínimo. Entrega: decisiones reproducibles y criterios de aceptación.

## Hito 1 — Vertical slice funcional
CLI ejecutable localmente; configuración de un proveedor permitido; prompt con streaming; sesión persistida; herramientas read/write/shell con gate de aprobación; cancelar/reanudar; logs y tests. No TUI compleja todavía.

**Criterio de aceptación:** una persona resuelve una tarea sobre un workspace temporal, inspecciona y aprueba cambios, y puede continuar la sesión con trazabilidad básica.

**Primer incremento propuesto:** evaluar el mecanismo de sesiones de Pi con creación y reanudación en un workspace temporal. Verificar continuidad, aislamiento por workspace, cierre, cancelación y privacidad antes de definir la mínima interfaz CLI necesaria. El prototipo actual usa sesiones en memoria.

## Hito 2 — Extensiones y distribución
Skills y MCP bajo policy, configuración por usuario/proyecto, tests de herramientas, empaquetado `your-gear` con npm, docs de uso para Windows/macOS/Linux. TUI simple si mejora la UX sin acoplar al core.

## Hito 3 — Workflows con humanos en el circuito
Clasificación simple de tareas, plan opcional, gates por pasos, verificación de resultados y auditoría. Integración futura de especificaciones SDD, sin exigirlas a cada operación.

## Hito 4 — Contexto y memoria opcional
Integrar una interfaz con RAG externo cuando exista caso real; no crear una base vectorial dentro del core. Políticas de contexto y minimización de información.

## Hito 5 — Robustez de producción
Instrumentación, recuperabilidad, compatibilidad, políticas avanzadas, documentación de contribución y releases; definir extensiones estables cuando haya consumidores reales.

## Regla de avance
No comenzar un hito por volumen de funciones: primero completar pruebas de aceptación del anterior y documentar desviaciones. La prioridad puede cambiar según resultados del spike.
