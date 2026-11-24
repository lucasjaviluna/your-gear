# Referencias técnicas — Your Gear

Your Gear es el proyecto principal, con arquitectura y roadmap propios. Las referencias son fuentes de aprendizaje y comparación, no dependencias obligatorias ni bases para copiar automáticamente.

## Your Harness v0

Repositorio: https://github.com/lucasjaviluna/your-harness-v0

Referencia incorporada por decisión del usuario. Consultar antes de diseñar capacidades equivalentes, especialmente:

- Hito 2: [validación y distribución](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/PHASE_8_VALIDATION.md), compatibilidad y MCP.
- Hito 3: clasificación, intake, rutas simple/task/SDD, OpenSpec, gates, trazabilidad y UX CLI/TUI. Consultar las fases 2–9 y 16.
- Hito 3.D / 4: [integración histórica Your Team Knowledge](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/YOUR_TEAM_KNOWLEDGE_INTEGRATION.md).
- Hito 5 y evolución futura: compatibilidad, rendimiento, recuperación, workspace y delegación.

El README de v0 describe estas capacidades y sus documentos; ello no acredita su paridad, seguridad o madurez. Su instalación como extensión de Pi difiere del CLI independiente de Your Gear. Revisar el código y las pruebas reales antes de reutilizar patrones, comprobar compatibilidad con la versión de SDK y preservar las políticas de Your Gear. No incorporar subagentes ni infraestructura antes de que el roadmap y los casos reales lo justifiquen.

## Your Team Knowledge (proveedor opcional)

Repositorio: https://github.com/lucasjaviluna/your-team-knowledge

A partir de 3.D.3–3.D.4 se integra por su contrato MCP, no por su código ni tablas. Consultar [contrato MCP](https://github.com/lucasjaviluna/your-team-knowledge/blob/main/docs/agent-memory-mcp.md), [arquitectura Go](https://github.com/lucasjaviluna/your-team-knowledge/blob/main/docs/technical-architecture.md) y [guía de consumidor nativo](https://github.com/lucasjaviluna/your-team-knowledge/blob/main/docs/agent-memory-native-consumer-guide.md). La referencia de v0 usaba un módulo TS histórico; el adaptador vigente usa pi-mcp. Ver [ADR-004](adr/ADR-004-optional-agent-memory.md). Validación con binario real pendiente.

## Agent Harness Lab

Repositorio: https://github.com/lucasjaviluna/agent-harness-lab

Laboratorio práctico de primitivas de Pi y pruebas incrementales. Usarlo como referencia técnica, no como arquitectura obligatoria.
