# Evaluación tecnológica — Hito 0

**Estado:** evaluación original del Hito 0 (2026-11-22), actualizada al PR #22 (2026-11-24). La selección está aceptada para el alcance validado; no certifica producción.

## Lenguaje y plataforma

| Opción | Ventajas | Costos/riesgos | Evaluación |
| --- | --- | --- | --- |
| TypeScript + Node.js | Ecosistema SDK agéntico, CLI, npm, tooling, tipado; integración directa con Pi | Runtime Node requerido, interoperabilidad y distribución | **Preferida** |
| Go | Binarios sencillos, concurrencia, CLI robustos | Necesidad de integrar SDK agéntico TS por proceso o recrear piezas | Alternativa futura |
| Rust | Seguridad de memoria, binarios | Mayor coste inicial de desarrollo y bindings/ecosistema | No para MVP |

**Decisión implementada:** TypeScript 5.8.x o compatible con el lockfile, Node.js >=22.19.0, CLI ESM con npm. CI usa Node 22.19.0. Sin monorepo; paquete privado 0.0.0, compilado por tsc.

## Motor de agentes

| Enfoque | Reutilización | Control | Coste inicial | Recomendación |
| --- | --- | --- | --- | --- |
| SDK Pi (integrado) | Alta: sesiones, tools, event stream, extensiones | Intermedio; requiere validar gates | Bajo/medio | Elegido (ADR-001) |
| Primitivas de Pi y runtime propio | Media | Mayor | Medio/alto | Plan B |
| Runtime/loop completamente propio | Baja | Máximo | Alto y más mantenimiento | Último recurso |

Pi mantiene un SDK documentado en la ruta [packages/coding-agent/docs/sdk.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md) y documenta auth/config en [providers.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md).

**Nota importante:** la documentación actual consultada usa el paquete `@earendil-works/pi-coding-agent` (en documentación anterior aparece `@mariozechner/pi-coding-agent`). El proyecto fija @earendil-works/pi-coding-agent 1.6.0 y @earendil-works/pi-mcp 1.6.0 como dependencias directas. El namespace anterior queda como referencia histórica. No se afirma que sean las últimas versiones publicadas.

## Autenticación del prototipo (revisado 2026-11-23)

Se eligió reutilizar el proveedor `openai` de Pi 1.6.0 y el **Sign in with ChatGPT** oficial de OpenAI, que utiliza la API pública Responses mediante OAuth. El runtime se resuelve con `ModelRuntime.create()` y credenciales administradas por Pi, sin copiar tokens en Your Gear. `openai-codex` es otro proveedor y no se usa en este camino. El modo API key es explícito y separado. Claude OAuth está bloqueado para este harness de terceros. Consultar [ADR-002](decisions/ADR-002-model-auth.md) y el [smoke Windows](spikes/manual-smoke-windows.md).

## Stack implementado

| Área | Selección vigente |
| --- | --- |
| CLI y configuración | APIs de Node, argumentos y JSON validados, readline/promises |
| Runtime y modelos | Pi Coding Agent SDK 1.6.0 / ModelRuntime |
| MCP | Extensión Pi para MCP directo; pi-mcp 1.6.0 para YTK |
| Tests | node:test y assert, fixtures MCP y respuestas de modelo simuladas |
| Compilación y distribución | tsc, npm pack, smoke local del paquete |
| Persistencia | SessionManager de Pi + journal JSONL de Your Gear |
| Agent Memory | YTK Go/SQLite/FTS5 externo, optativo por MCP; no SQLite directo en Your Gear |
| CI | GitHub Actions: Ubuntu, Windows, macOS |

**Pendiente:** SDD/OpenSpec (3.E), entrada unificada (4), conectores (5), resiliencia (6), recall general y RAG documental (7), observabilidad (8), TUI (9) y producción (10). Las bibliotecas TUI y exportadores se evaluarán por evidencia; ver [arquitectura objetivo](target-architecture.md). No hay dependencia npm de OpenSpec ni base vectorial interna. 3.E.1 propone uso de CLI instalada externamente, con diagnóstico y probe de versión. OpenSpec npm v2.2.0 exige Node >=22.20.0; el mínimo de Gear no cambia. Ver [ADR-006](decisions/ADR-006-openspec-cli.md).

## Protocolo histórico de evaluación del spike
1. Obtener modelo y auth permitidos, sin crear secretos en git.
2. Iniciar sesión, hacer un prompt, emitir streaming, registrar errores y finalizar.
3. Verificar hooks/aprobación ANTES de ejecutar una herramienta de escritura o shell.
4. Asegurar que deshabilitar/cancelar efectivamente bloquea efectos.
5. Persistir/reanudar sesión sin duplicar herramientas ni perder contexto.
6. Verificar comportamiento en Windows (paths, powershell, Ctrl+C).

**Gate de evolución:** la adopción de Pi es válida para las capacidades comprobadas; cada vía nueva requiere evidencia de política y límites. Si falla la interceptación fiable, restringirla o evaluar primitivas inferiores. Ver [seguridad](security.md) y [roadmap](roadmap.md).

## Fuentes comprobadas
- Pi, SDK: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md
- Pi, providers: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md
- Anthropic, legal/compliance: https://code.claude.com/docs/en/legal-and-compliance
