# ADR-001 — Runtime agéntico

**Estado:** Propuesto; decisión final pendiente de spike
**Fecha:** 2026-11-22

## Contexto
Necesitamos sesiones, streaming, herramientas, cancelaciones, autenticación de proveedores e integración CLI. Crear loop desde cero consume esfuerzo y aumenta superficie de error.

## Alternativas
1. Integrar Pi Coding Agent SDK en proceso.
2. Construir runtime propio sobre primitivas inferiores del ecosistema Pi.
3. Implementar loop/gestión completamente propios.

## Decisión provisional
**Evaluar primero Pi SDK**, dentro de una aplicación Your Gear propia. El SDK no definirá la identidad del producto ni la UX. No se aprueba aún como dependencia definitiva.

## Por qué
Ofrece un punto de partida técnico con sesiones, herramientas, eventos y extensiones. Reduce el tiempo hasta una primera ejecución real y permite enfocar la ingeniería en políticas, experiencia, configuración y pruebas.

## Condiciones obligatorias para aceptar
- Gate previo y no evadible para herramientas peligrosas, incluyendo extensiones/MCP.
- Cancelación y cierre sin efectos secundarios inesperados.
- Error handling y reanudación de sesión comprobables.
- Integración por API pública versionada; compatibilidad Windows verificada.
- Credenciales autorizadas por proveedor; ningún requisito de usar OAuth Claude en terceros.

## Plan B
Si un gate no puede garantizarse, usar primitivas de nivel inferior y ejecutar herramientas bajo nuestra propia autoridad. Evitar replicar sesiones si las existentes son fiables.

## Evidencia
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md

## Revisión
Actualizar a **Aceptado** o **Rechazado** al terminar `docs/spikes/pi-sdk.md`, con resultados, versión instalada y pruebas reproducibles.
