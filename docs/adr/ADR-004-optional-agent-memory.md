# ADR-004 — Memoria agéntica opcional mediante MCP

Estado: aceptado como decisión arquitectónica, implementación experimental integrada en PR #21 y #22 con CI exitoso; aceptación con binario YTK real pendiente. Fecha: 2026-11-24.

## Contexto

El journal de workflows guarda transiciones, decisiones y hashes, no el objetivo o plan completo. Antes de 3.D.4 recuperar una tarea interrumpida exigía describir el trabajo pendiente. La recuperación asistida es ahora optativa; la manual sigue disponible. Your Team Knowledge (YTK) ya ofrece memoria local en Go/SQLite/FTS5, con MCP stdio, sesiones, subjectKey y lectura por ID.

## Decisión

- Your Gear conserva la autoridad sobre el ciclo de vida, las políticas, aprobaciones y ejecución; Pi conserva conversaciones; YTK conserva conocimiento y, en 3.D.4, checkpoints curados. Ninguna memoria autoriza herramientas ni demuestra el estado actual del código.
- Integración optativa mediante un puerto MemoryProvider pequeño, un adaptador YTK MCP y configuración exclusiva del usuario, asociada a la ruta canónica exacta del workspace. Sin importación de módulos Go, lectura de tablas SQLite ni dependencia del código fuente de YTK. Se reutiliza pi-mcp 1.6.0, ya presente transitivamente en el lockfile, como dependencia directa.
- En 3.D.3 se expusieron inicialmente comandos locales de consulta y diagnóstico; no se añade MCP a los agentes. El arranque del binario explícito exige autorización; el servidor podría aplicar migraciones al abrir la base. El adaptador implementó start/save/finish, habilitados en 3.D.4 solo por opt-in del workflow. Una sesión requiere mantener la misma conexión por ownership de YTK. La configuración no puede venir del workspace.
- En 3.D.4, --memory y la autorización explícita del resumen y scope permiten checkpoints sin gates por operación; la divulgación al LLM requiere revisión del contexto recuperado. Guardar checkpoints antes de efectos y al avanzar; asociar ID exacto de memoria y digest al journal. Recuperar por ID, validar alcance, lifecycle, contenido y vigencia; no buscar por similitud como fuente de verdad. El resultado de memoria es dato no confiable; replanificar con el estado actual y nuevas aprobaciones. Nunca restaurar autorizaciones ni hacer replay.
- Ausencia o fallo de YTK no impide los workflows existentes. Ante una escritura cuyo resultado sea incierto, no se reintenta automáticamente; subjectKey por UUID/fase y lectura de confirmación, sin reconciliación automática de memorias huérfanas. No prometer atomicidad entre SQLite y journal. La recuperación manual permanece disponible.
- No guardar secretos, prompts/transcripciones crudos ni código completo automáticamente. Checkpoints serán resúmenes curados, explícitamente autorizados, con presupuesto. El filtro de YTK no es DLP exhaustivo.

## Alcance actual

El checkpoint contiene objetivo, alcance, pasos, criterios, rutas y una observación acotada, hasta 12000 caracteres UTF-16. No es un registro de herramientas ni conserva el plan íntegro. El journal mantiene ID, hash del contenido y hash del scope (workspace canónico, proyecto, DB y área configurada); no guarda el texto. El cierre de memoria es best-effort sin resumen adicional: los checkpoints ya contienen las observaciones. El briefing general devuelto al iniciar sesión aún no se usa. No se guardan checkpoints antes del plan aprobado ni durante cada llamada individual del executor. --recover lista candidatos recientes y --recover ID recupera datos históricos, no permisos. Ver [Hito 3](../milestones/milestone-3.md).

## Alternativas descartadas

SQLite compartido directo: acoplamiento a esquema y migraciones. MCP expuesto indiscriminadamente al modelo: permite escrituras no controladas. Reemplazar el journal por YTK: el timeline no conserva todas las transiciones y no representa permisos. Dependencia obligatoria de YTK: elimina operación autónoma de Gear.

## Consecuencias

Se añade un proceso local opcional, una frontera de compatibilidad y manejo de fallos. No es sandbox ni garantía de cancelación de todos los descendientes. Los resultados se acotan y se verifica el projectId; área es filtro lógico. El binario debe ser confiable, instalado y actualizado por el usuario. El adaptador debe probarse con un release YTK real antes de habilitar checkpoints por defecto o usarlos con datos reales. 3.D.4 ofrece opt-in experimental por ejecución, con autorización explícita y workspace descartable; smoke real pendiente. El briefing general no se inyecta todavía.

Referencias: [contrato MCP](https://github.com/lucasjaviluna/your-team-knowledge/blob/main/docs/agent-memory-mcp.md), [servidor Go](https://github.com/lucasjaviluna/your-team-knowledge/blob/main/native/ytk-memory/internal/surface/server.go), [arquitectura YTK](https://github.com/lucasjaviluna/your-team-knowledge/blob/main/docs/technical-architecture.md), [integración histórica v0](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/YOUR_TEAM_KNOWLEDGE_INTEGRATION.md). La integración v0 por módulo TypeScript no se reutiliza: YTK migró a Go.
