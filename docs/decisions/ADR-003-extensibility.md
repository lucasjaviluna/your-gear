# ADR-003 — Extensibilidad progresiva

**Estado:** Aceptado como criterio de evolución progresiva
**Fecha:** 2026-11-22 · **Revisión:** 2026-11-24 (PR #22)

## Contexto
Queremos herramientas, MCP, skills y workflows reemplazables, sin fabricar un framework antes de comprobar las necesidades.

## Decisión
1. Primero usar extensiones y recursos soportados por el runtime elegido.
2. Mantener configuración de Your Gear y política de ejecución como responsabilidades propias.
3. Añadir un adaptador estable cuando haya al menos dos implementaciones reales o una necesidad de aislamiento.
4. No permitir que plugins, MCP o skills modifiquen permisos ni invoquen efectos al margen de la política.
5. No prometer hot reload, marketplace o versionado complejo en MVP.

## Evolución
- Hito 1: herramientas built-in controladas y configuración sencilla.
- Hito 2: skills y MCP con policies, logs y tests.
- Hito 3: workflows explícitos y gates, memoria externa opcional por un puerto pequeño; no API pública de plugins aún. SDD/OpenSpec pendiente. Hito 5 evaluará interfaces estables según consumidores reales.

## Evidencia y preguntas pendientes
El prototipo registra el hook `tool_call` para las herramientas integradas `read`, `write`, `edit` y `bash`. El usuario reportó pruebas manuales exitosas del flujo del Hito 1. La carga automática de skills está deshabilitada; puede seleccionarse un `SKILL.md` del workspace explícitamente. Extensiones externas y recursos de contexto siguen deshabilitados; MCP está deshabilitado por defecto; el incremento 2.A integró selección explícita de un servidor stdio confiable, con aprobación de arranque y por llamada. Las pruebas del Hito 2 cubren un servidor MCP local de prueba, sin demostrar garantías para servidores arbitrarios. En 3.D.3–3.D.4 se añade un caso concreto de aislamiento: MemoryProvider con cliente pi-mcp y adaptador YTK por fuera del registro de tools de los modelos. No se conceden herramientas adicionales a los agentes. Ver [ADR-004](../adr/ADR-004-optional-agent-memory.md). El executor task conserva read/write/edit y el harness controla pruebas Node explícitas; no hay shell ni MCP del modelo en ese modo.

- Verificar cada ruta nueva de ejecución antes de habilitarla; ninguna puede evadir el gate.
- ¿Cómo se comparten/aislan instancias de MCP y permisos entre sesiones?
- ¿Qué capacidades deben ir en un proceso aislado?
- ¿Qué recursos de Pi pueden utilizarse tal cual y cuáles requieren adaptadores?

## Fuente
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md
