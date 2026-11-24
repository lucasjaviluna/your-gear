# Hito 2 — Extensiones y distribución

**Estado:** implementación 2.A–2.D integrada y CI exitoso; aceptación manual pendiente.

## Alcance previsto

El roadmap incluye skills y MCP bajo política, configuración por usuario y proyecto, pruebas de herramientas, empaquetado npm y documentación multiplataforma. Se avanzará por incrementos; la TUI se evaluará solo si aporta una mejora concreta.

## Primera evaluación: recursos y herramientas de Pi

Inspección estática de la dependencia instalada `@earendil-works/pi-coding-agent` 1.6.0 y del CLI actual:

- Your Gear crea un `DefaultResourceLoader` con `noExtensions`, `noSkills`, `noPromptTemplates` y `noContextFiles`, y añade explícitamente la fábrica que registra el gate. No configura servidores MCP.
- Pi admite rutas adicionales de skills y extensiones incluso con las opciones `noSkills` y `noExtensions`, respectivamente. Por lo tanto, cualquier ruta explícita futura debe evaluarse por separado; las opciones actuales no son una prohibición universal.
- Una prueba local con `DefaultResourceLoader` real confirmó que `noSkills` omite una skill del proyecto y que una ruta añadida explícitamente se carga aun con `noSkills`. Es una prueba del loader, no del CLI completo ni de la ejecución de la skill. Pasaron 45 tests y typecheck localmente.
- Pi puede expandir comandos de skill a contenido en el mensaje. Esa carga es una ruta distinta de una llamada normal a `read`; la política de rutas actual no demuestra control sobre ella.
- Según la declaración del SDK, una lista de herramientas que no incluya nombres `mcp__` puede dejar herramientas MCP registradas para codemode y búsqueda de herramientas. Una lista de herramientas por sí sola no demuestra que todas las vías de MCP estén desactivadas.
- El código de la sesión instala el hook `beforeToolCall` y lo reutiliza para llamadas anidadas mediante `ctx.executeTool()`. La política actual deniega nombres desconocidos. Estas observaciones no prueban que toda operación posible de una extensión o servidor atraviese ese hook: una extensión o proceso puede producir efectos por otras vías.
- Una prueba con la sesión y el ciclo de herramientas reales de Pi, y una respuesta de modelo simulada, confirmó que el gate deniega una herramienta desconocida tanto directamente como mediante `ctx.executeTool()`, antes de ejecutar su efecto. Para probar la llamada anidada se autorizó una herramienta padre de prueba; la política de producción también la denegaría. No se probó un servidor MCP ni efectos producidos directamente por una extensión. La suite local pasó con 46 tests y typecheck.
- Una prueba con la extensión MCP de Pi habilitada explícitamente confirmó que, al iniciar la sesión, intenta crear la conexión antes de cualquier `tool_call`, incluso con la lista de herramientas integradas. El transporte de prueba falla deliberadamente: no inicia un proceso ni conecta un servidor, y no valida la ejecución de herramientas MCP ni el cierre de conexiones. Esto implica que una política futura también deberá controlar la habilitación y el arranque del servidor, antes del gate de herramientas. La suite local pasó con 47 tests y typecheck.
- Una prueba posterior con un servidor MCP local descartable comprobó la conexión stdio, el bloqueo de una llamada y la ejecución de otra autorizada a través del hook, y el cierre del proceso mediante `session_shutdown`. El modelo se simuló y la política de autorización se limitó a la prueba; no demuestra seguridad de servidores arbitrarios.
- La configuración local permite seleccionar `provider` y `model` mediante archivos de usuario y proyecto, con prioridad de las variables de entorno. El modo API y la clave siguen siendo explícitos en el entorno. La suite pasó con 48 tests y typecheck en Windows.
- Se agregó compilación a JavaScript y entrada `your-gear` para un paquete npm privado. En Windows se generó un tarball, se instaló en un directorio temporal y el comando instalado mostró el mensaje de uso. Se agregó una matriz de CI para Windows, Linux y macOS, con CI del PR #8 exitoso en las tres plataformas (run 45281357403). El PR #11 añadió y validó el smoke de instalación en las tres plataformas (ver 2.C).
- El CLI admite seleccionar explícitamente un único `SKILL.md` del workspace con `--skill`; la carga automática sigue deshabilitada. Se validan rutas externas, protegidas y enlaces externos antes de cargar. El usuario confirmó en Windows el uso de la skill con un modelo real y el rechazo de una ruta externa. Las pruebas automatizadas ejercitan la selección y el loader de Pi; la suite local pasó con 50 tests y typecheck.

## Incremento 2.A — MCP explícito (PR #9 integrado)

- Registro de usuario `~/.your-gear/mcp.json`, selección de un servidor local stdio con `--mcp` y ejecutable absoluto. No se carga configuración MCP del workspace.
- Aprobación previa al arranque, antes de crear la extensión; sin TTY se deniega. Nombres exactos de herramientas autorizadas, con aprobación por llamada y bloqueo por defecto. Las herramientas adicionales que registre el SDK no reciben permisos.
- Se espera el registro de las herramientas configuradas antes del prompt y se emite `session_shutdown` en el cierre. La prueba de ciclo de vida reutiliza los helpers de producción y el gate.
- Se agregan tests de validación, opt-in, denegación y disponibilidad, y build a CI. CI del PR #9 exitoso (run 45310044405); smoke manual pendiente; no se afirma aceptación ni aislamiento de procesos.

## Incremento 2.B — Endurecimiento de políticas (PR #10 integrado)

- Aprobaciones serializadas para impedir preguntas concurrentes, cancelación de la pregunta activa y rechazo de aprobaciones tardías.
- Señal de cancelación compartida desde el CLI, bloqueo de operaciones posteriores en el gate, espera de herramientas MCP cancelable y código de salida 130.
- Pruebas de cola, rechazo posterior a cancelación y herramientas extra con servidor stdio descartable. El cierre continúa utilizando session_shutdown del SDK.
- Limitaciones: no se garantiza interrumpir bindExtensions o conexiones internas del SDK, detener procesos descendientes ni revertir efectos. CI del PR #10 exitoso (run 45310838794); smoke manual pendiente.

## Incremento 2.C — Distribución y smoke del paquete (PR #11 integrado)

- Comandos `--help` y `--version` con salida exitosa, sin configuración de proveedor ni credenciales.
- `npm run pack:check`: compila, genera un tarball real, verifica sus entradas, instala dependencias de producción en un directorio temporal y ejecuta el bin instalado mediante npm. Comprueba ayuda, versión y error de opción inválida, sin invocar un modelo. Elimina el directorio temporal al finalizar.
- La matriz CI ejecuta el smoke en Linux, Windows y macOS. No se publica el paquete ni se altera la instalación global.
- Referencias: se incorpora Your Harness v0 a [referencias técnicas](../references.md). El CLI de Your Gear sigue siendo independiente.
- CI del PR #11 exitoso (run 45311599196): typecheck, tests, build, tarball, instalación y smoke del ejecutable en Windows, Linux y macOS. Smoke con modelo real pendiente.

## Incremento 2.D — Aceptación integral (PR #12 integrado)

- Rechazo de MCP sin TTY antes de cargar configuración, autenticación o extensiones; smoke del bin instalado con un servidor que dejaría un marcador si se iniciara.
- [Matriz de aceptación y guía reproducible](../spikes/milestone-2-acceptance.md), con separación entre evidencia CI, evidencia previa de usuario y pruebas manuales pendientes.
- [Diseño inicial del Hito 3](milestone-3.md) basado en las referencias, sin activar workflows ni cambiar la regla de avance.
- CI del PR #12 exitoso (run 45312487354); la confirmación manual del usuario sigue pendiente. No se declara el hito completamente cerrado.

## Próximo incremento

Registrar los resultados de la guía de aceptación. El desarrollo aislado de 3.A se prepara en paralelo, sin habilitar ejecución de workflows ni declarar cerrado el Hito 2. Cerrar el Hito 2 únicamente con evidencia suficiente o una desviación de alcance explícitamente acordada. No habilitar servidores arbitrarios ni extensiones externas.

Las extensiones externas siguen deshabilitadas. MCP queda deshabilitado por defecto; la habilitación explícita propuesta requiere revisión y aceptación. El proceso no es un sandbox, y el ADR-003 requiere verificar cada vía nueva antes de incorporarla.
