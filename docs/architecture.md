# Arquitectura candidata — Your Gear

**Estado:** arquitectura evolutiva; el prototipo implementa parcialmente el flujo · actualización 2026-11-23

El prototipo usa Pi SDK 1.6.0 y sesiones en memoria por defecto, con persistencia y reanudación optativas. El Hito 1 completó el flujo validado en Windows, incluida la trazabilidad básica; el usuario reportó recuperación de contexto tras cancelar una generación y un comando en espera. No se han validado todas las formas de cancelación ni una auditoría completa. Una skill del workspace puede seleccionarse explícitamente; extensiones externas siguen deshabilitadas. El incremento 2.A propone MCP stdio con selección explícita, registro de usuario y doble autorización. Ver [Hito 1](milestones/milestone-1.md), [Hito 2](milestones/milestone-2.md), [ADR-001](decisions/ADR-001-runtime.md) y [ADR-003](decisions/ADR-003-extensibility.md).

```text
Human / terminal
    |
 CLI / TUI (futura)
    |
 Your Gear application layer
    |-- config + provider resolution
    |-- execution policy / approval UX
    |-- execution trace + user-visible errors
    |
 Agent runtime boundary
    |-- agent loop + streaming
    |-- session lifecycle + compaction
    |-- tools / extension integration
    |
 Providers, filesystem, shell, persistent sessions
```

## Responsabilidades
- **CLI:** entrada/salida, comandos, presentación, Ctrl+C. No contiene lógica de permisos.
- **Aplicación:** prepara contexto, inicia sesión y aplica configuración/políticas.
- **Runtime boundary:** encapsula crear sesión, enviar prompt, escuchar eventos, cancelar y cerrar; empezar con la API del SDK y crear interfaz propia solo si lo justifican pruebas de migración.
- **Herramientas:** ejecutar con identidad/argumentos conocidos y revisión previa. La política se aplica antes del efecto real, independientemente de la UI.
- **Autenticación:** pasar credenciales admitidas por proveedor sin persistir tokens en el repositorio ni loguearlos.
- **Sesiones:** usar mecanismo existente si entrega continuidad, aislamiento por workspace y cierre limpio.
- **Trazabilidad:** eventos mínimos de prompt, permiso, tool start/end, error y cancelación; redactar secretos.
- **Extensibilidad:** skills, extensiones y MCP por pasos. Ninguna ruta de extensión puede evadir el gate.

## Flujo esperado
1. Usuario inicia CLI con `cwd` y configuración explícitos.
2. Se selecciona proveedor y se valida auth permitida; mensaje accionable si falta.
3. Runtime crea/recupera sesión y el usuario envía un prompt.
4. Streams de texto/eventos llegan a UI.
5. Si el modelo solicita herramienta de riesgo, el gate revisa operación, argumentos, alcance y aprobación.
6. Se ejecuta o deniega la herramienta, registrando resultado sin secretos.
7. Persistencia de sesión y cierre/cancelación limpios.

## Políticas (diseño propuesto)
- `read`: inicialmente permitida solo dentro del workspace, sin leer secretos conocidos ni seguir rutas fuera del alcance; revisar riesgos de symlinks.
- `write/edit`: solicitar aprobación, presentar ruta y cambio; deny por defecto en no interactivo.
- `shell`: aprobación por comando, cwd y alcance; deny por defecto en no interactivo.
- Acceso a red/MCP: evaluación específica por servidor y operación; no clasificar arbitrariamente como seguro.
- Modo autoaprobación futura: habilitación explícita y limitada por configuración verificada, nunca como default.

## Consideraciones de seguridad
Prompt injection no debe alterar políticas; las decisiones se ejecutan fuera del contexto del modelo. Capturar cambios no basta: bloquear antes del efecto. El proceso no es un sandbox por defecto; para contenido no confiable se necesitará aislamiento adicional.

## No introducir aún
- Sistema universal de eventos/DI, colas, microservicios, registro distribuido de plugins.
- Persistencia adicional si la de Pi satisface la prueba.
- Contratos públicos definitivos de SDK hasta evaluar límites reales.
