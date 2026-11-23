# Evaluación tecnológica — Hito 0

**Estado:** candidatos; selección final del runtime pendiente de spike · 2026-11-22.

## Lenguaje y plataforma

| Opción | Ventajas | Costos/riesgos | Evaluación |
| --- | --- | --- | --- |
| TypeScript + Node.js | Ecosistema SDK agéntico, CLI, npm, tooling, tipado; integración directa con Pi | Runtime Node requerido, interoperabilidad y distribución | **Preferida** |
| Go | Binarios sencillos, concurrencia, CLI robustos | Necesidad de integrar SDK agéntico TS por proceso o recrear piezas | Alternativa futura |
| Rust | Seguridad de memoria, binarios | Mayor coste inicial de desarrollo y bindings/ecosistema | No para MVP |

**Decisión provisional de plataforma:** TypeScript + Node.js, una aplicación CLI en un repositorio simple; no monorepo hasta necesitarlo. Definir versión mínima LTS concreta al iniciar el scaffolding.

## Motor de agentes

| Enfoque | Reutilización | Control | Coste inicial | Recomendación |
| --- | --- | --- | --- | --- |
| SDK Pi (integrado) | Alta: sesiones, tools, event stream, extensiones | Intermedio; requiere validar gates | Bajo/medio | Primer spike |
| Primitivas de Pi y runtime propio | Media | Mayor | Medio/alto | Plan B |
| Runtime/loop completamente propio | Baja | Máximo | Alto y más mantenimiento | Último recurso |

Pi mantiene un SDK documentado en la ruta [packages/coding-agent/docs/sdk.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md) y documenta auth/config en [providers.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md).

**Nota importante:** la documentación actual consultada usa el paquete `@earendil-works/pi-coding-agent` (en documentación anterior aparece `@mariozechner/pi-coding-agent`). No fijar imports ni dependencias hasta verificar el nombre y la versión publicados en npm en el momento del spike.

## Librerías complementarias (candidatas, no decisiones)
- CLI: comandos mínimos con Node; elegir parser solo si evita código relevante.
- TUI: validar con prototipo después del CLI; no acoplar el core a un renderer.
- Validación/config: usar esquema tipado solo cuando exista un contrato concreto.
- Tests: Vitest o runner nativo de Node; priorizar integración de seguridad de tools.
- Persistencia: reutilizar sesiones del SDK si cumplen recuperación y aislamiento; no introducir DB por adelantado.
- MCP/skills/extensiones: comenzar por capacidades nativas del runtime; adaptadores extra solo por necesidades demostradas.

## Protocolo de evaluación del spike
1. Obtener modelo y auth permitidos, sin crear secretos en git.
2. Iniciar sesión, hacer un prompt, emitir streaming, registrar errores y finalizar.
3. Verificar hooks/aprobación ANTES de ejecutar una herramienta de escritura o shell.
4. Asegurar que deshabilitar/cancelar efectivamente bloquea efectos.
5. Persistir/reanudar sesión sin duplicar herramientas ni perder contexto.
6. Verificar comportamiento en Windows (paths, powershell, Ctrl+C).

**Gate:** si falla la interceptación fiable de herramientas, no se adopta el SDK sin un wrapper seguro probado.

## Fuentes comprobadas
- Pi, SDK: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md
- Pi, providers: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md
- Anthropic, legal/compliance: https://code.claude.com/docs/en/legal-and-compliance
