# ADR-003 — Extensibilidad progresiva

**Estado:** Propuesto
**Fecha:** 2026-11-22

## Contexto
Queremos herramientas, MCP, skills y workflows reemplazables, sin fabricar un framework antes de comprobar las necesidades.

## Propuesta
1. Primero usar extensiones y recursos soportados por el runtime elegido.
2. Mantener configuración de Your Gear y política de ejecución como responsabilidades propias.
3. Añadir un adaptador estable cuando haya al menos dos implementaciones reales o una necesidad de aislamiento.
4. No permitir que plugins, MCP o skills modifiquen permisos ni invoquen efectos al margen de la política.
5. No prometer hot reload, marketplace o versionado complejo en MVP.

## Evolución
- Hito 1: herramientas built-in controladas y configuración sencilla.
- Hito 2: skills y MCP con policies, logs y tests.
- Hito 3+: hooks/plugins y workflows humanos con gates; si surgen casos reales, API pública de extensiones.

## Preguntas pendientes
- ¿Qué hooks ofrece el SDK para interceptar llamadas antes de los efectos?
- ¿Cómo se comparten/aislan instancias de MCP y permisos entre sesiones?
- ¿Qué capacidades deben ir en un proceso aislado?
- ¿Qué recursos de Pi pueden utilizarse tal cual y cuáles requieren adaptadores?

## Fuente
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md
