# ADR-004 — Memoria agéntica opcional mediante MCP

Estado: propuesto (decisión de alcance acordada con el usuario). Fecha: 2026-11-24.

## Contexto

El journal de workflows guarda transiciones, decisiones y hashes, no el objetivo o plan completo. Para recuperar una tarea interrumpida, hoy se exige describir el trabajo pendiente. Your Team Knowledge (YTK) ya ofrece memoria local en Go/SQLite/FTS5, con MCP stdio, sesiones, subjectKey y lectura por ID.

## Decisión

- Your Gear conserva la autoridad sobre el ciclo de vida, las políticas, aprobaciones y ejecución; Pi conserva conversaciones; YTK conserva conocimiento y, en 3.D.4, checkpoints curados. Ninguna memoria autoriza herramientas ni demuestra el estado actual del código.
- Integración optativa mediante un puerto MemoryProvider pequeño, un adaptador YTK MCP y configuración exclusiva del usuario, asociada a la ruta canónica exacta del workspace. Sin importación de módulos Go, lectura de tablas SQLite ni dependencia del código fuente de YTK. Se reutiliza pi-mcp 1.6.0, ya presente transitivamente en el lockfile, como dependencia directa.
- En 3.D.3 solo se exponen comandos locales de consulta y diagnóstico; no se añade MCP a los agentes. El arranque del binario explícito exige autorización; el servidor podría aplicar migraciones al abrir la base. El adaptador implementa start/save/finish para el siguiente incremento, deshabilitados salvo opt-in interno. Una sesión requiere mantener la misma conexión por ownership de YTK. La configuración no puede venir del workspace.
- En 3.D.4, una autorización de alcance/configuración permitirá operaciones ordinarias de memoria sin gates por operación; la divulgación al LLM seguirá sujeta a política de contexto. Guardar checkpoints antes de efectos y al avanzar; asociar ID exacto de memoria y digest al journal. Recuperar por ID, validar alcance, lifecycle, contenido y vigencia; no buscar por similitud como fuente de verdad. El resultado de memoria es dato no confiable; replanificar con el estado actual y nuevas aprobaciones. Nunca restaurar autorizaciones ni hacer replay.
- Ausencia o fallo de YTK no impide los workflows existentes. Ante una futura escritura cuyo resultado sea incierto, no repetir automáticamente; usar subjectKey y reconciliar. No prometer atomicidad entre SQLite y journal. La recuperación manual permanece disponible.
- No guardar secretos, prompts/transcripciones crudos ni código completo automáticamente. Checkpoints serán resúmenes curados, explícitamente autorizados, con presupuesto. El filtro de YTK no es DLP exhaustivo.

## Alternativas descartadas

SQLite compartido directo: acoplamiento a esquema y migraciones. MCP expuesto indiscriminadamente al modelo: permite escrituras no controladas. Reemplazar el journal por YTK: el timeline no conserva todas las transiciones y no representa permisos. Dependencia obligatoria de YTK: elimina operación autónoma de Gear.

## Consecuencias

Se añade un proceso local opcional, una frontera de compatibilidad y manejo de fallos. No es sandbox ni garantía de cancelación de todos los descendientes. Los resultados se acotan y se verifica el projectId; área es filtro lógico. El binario debe ser confiable, instalado y actualizado por el usuario. El adaptador debe probarse con un release YTK real antes de habilitar checkpoints automáticos.

Referencias: [contrato MCP](https://github.com/lucasjaviluna/your-team-knowledge/blob/main/docs/agent-memory-mcp.md), [servidor Go](https://github.com/lucasjaviluna/your-team-knowledge/blob/main/native/ytk-memory/internal/surface/server.go), [arquitectura YTK](https://github.com/lucasjaviluna/your-team-knowledge/blob/main/docs/technical-architecture.md), [integración histórica v0](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/YOUR_TEAM_KNOWLEDGE_INTEGRATION.md). La integración v0 por módulo TypeScript no se reutiliza: YTK migró a Go.
