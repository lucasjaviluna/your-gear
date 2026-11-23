# ADR-001 — Runtime agéntico

**Estado:** Aceptado para el alcance validado del Hito 0
**Fecha:** 2026-11-22

## Contexto
Necesitamos sesiones, streaming, herramientas, cancelaciones, autenticación de proveedores e integración CLI. Crear loop desde cero consume esfuerzo y aumenta superficie de error.

## Alternativas
1. Integrar Pi Coding Agent SDK en proceso.
2. Construir runtime propio sobre primitivas inferiores del ecosistema Pi.
3. Implementar loop/gestión completamente propios.

## Decisión
Usar **Pi Coding Agent SDK 1.6.0** dentro de una aplicación Your Gear propia. Esta aceptación cubre el prototipo y las herramientas actualmente habilitadas; el SDK no define la identidad ni la UX del producto.

## Por qué
Ofrece un punto de partida técnico con sesiones, herramientas, eventos y extensiones. Reduce el tiempo hasta una primera ejecución real y permite enfocar la ingeniería en políticas, experiencia, configuración y pruebas.

## Alcance y condiciones posteriores
La propuesta original exigía demostrar gate para extensiones/MCP y reanudación antes de aceptar el runtime. Se acota expresamente la decisión al alcance actual: extensiones externas y skills están deshabilitadas y no se habilita MCP. Antes de habilitar cualquier nueva vía de ejecución debe comprobarse que no evade la política. Persistencia, reanudación y aislamiento por workspace son criterios del Hito 1. El smoke de cancelación reportado no demuestra ausencia de todos los efectos secundarios.

Actualización del Hito 2: se admite la selección explícita de un archivo `SKILL.md` del workspace, con comprobación de ruta antes de cargarlo; la carga automática sigue deshabilitada. MCP y extensiones externas continúan deshabilitados. La aceptación inicial de este ADR y el smoke del Hito 1 preceden a esta ampliación; sus límites y pruebas nuevas se registran en [Hito 2](../milestones/milestone-2.md).

## Plan B
Si un gate no puede garantizarse, usar primitivas de nivel inferior y ejecutar herramientas bajo nuestra propia autoridad. Evitar replicar sesiones si las existentes son fiables.

## Evidencia
- El usuario reportó ejecución real con ChatGPT y pruebas manuales exitosas en Windows, incluyendo streaming, herramientas, cancelación y errores; ver [registro](../spikes/manual-smoke-windows.md).
- El usuario reportó validación de rutas externas y escritura sin TTY. Las pruebas automatizadas adicionales cubren el gate y un proceso sin TTY; no prueban por sí solas el loop real.
- CI del PR #2: 33 tests; verificación local posterior: 35 tests y typecheck. No se afirma CI verde para los cambios posteriores.
- La ejecución usa `SessionManager.inMemory`; reanudación no está validada. macOS y Linux no tienen smoke real documentado.
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md

## Revisión
Revisar ante cambios del SDK, nuevas herramientas o evidencia que cuestione el gate, la recuperación o la compatibilidad.
