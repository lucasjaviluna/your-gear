# Your Gear

**Your Gear** es un harness de agentes de IA configurable y extensible con una experiencia CLI terminal-first.

> **Estado:** Hitos 0 y 1 completados para el alcance validado. El prototipo usa Pi SDK, persistencia optativa y una política de herramientas; el flujo de aceptación fue comprobado en Windows. El Hito 2 está en aceptación: skills explícitas, MCP experimental y distribución local con CI multiplataforma exitoso.

## Inicio rápido: suscripción ChatGPT a través de Pi

Requiere **Node.js >=22.19.0**, npm y `@earendil-works/pi-coding-agent@1.6.0`. Your Gear no implementa ni lee tokens OAuth: consulta el **ModelRuntime de Pi** con las credenciales que Pi ya administra.

1. Instalar dependencias: `npm install --ignore-scripts`.
2. Iniciar sesión en **Pi** (ejecutar `pi`, usar `/login`, seleccionar **OpenAI → Sign in with ChatGPT**). El login bajo `openai-codex` es diferente y no se reutiliza como `openai`.
3. Confirmar desde Your Gear:
   ```sh
   node src/cli.ts auth status
   node src/cli.ts models
   ```
4. En un **workspace temporal sin datos sensibles**, ejecutar:
   ```sh
   node /ruta/a/your-gear/src/cli.ts "Respondé hola y no uses herramientas"
   ```

Por defecto se usa `YOUR_GEAR_AUTH_MODE=pi-subscription`, el proveedor `openai` y el primer modelo disponible que también figura en el catálogo Codex de Pi. Para fijar uno, definir `YOUR_GEAR_MODEL` con un ID de `models`. La disponibilidad real depende de la cuenta y del backend. El CLI informa el modelo seleccionado y muestra los errores del proveedor sin imprimir tokens. El uso está sujeto a los límites y condiciones de la suscripción y al permiso aprobado en el login.

### Configuración por usuario y proyecto

Opcionalmente, crear `~/.your-gear/config.json` o `.your-gear/config.json` dentro del workspace con `provider` y/o `model` como cadenas:

```json
{ "provider": "openai", "model": "ID_DEL_MODELO" }
```

El proyecto prevalece sobre el usuario y las variables `YOUR_GEAR_PROVIDER` y `YOUR_GEAR_MODEL` prevalecen sobre ambos. Se rechazan opciones desconocidas y JSON inválido. La autenticación y las claves se configuran mediante las variables de entorno documentadas; los archivos no pueden activar el modo API ni almacenar claves.

### Paquete local

Con las dependencias de desarrollo instaladas, `npm pack` compila el CLI y genera un tarball. Para probarlo, instalá ese archivo con `npm install -g ./your-gear-0.0.0.tgz` y ejecutá `your-gear` en una terminal. En Windows, macOS y Linux se requiere Node.js 22.19 o superior. `your-gear --help` y `your-gear --version` permiten comprobar la instalación sin credenciales. Para generar e instalar el paquete en un prefijo temporal y verificar su ejecutable sin publicar ni modificar instalaciones globales, ejecutar `npm run pack:check`. El paquete sigue marcado como privado; su publicación y licencia están pendientes.

### Analizar una tarea sin ejecutarla

```sh
your-gear --analyze-only "Agregar permisos por rol"
```

El clasificador usa el modelo configurado mediante la autenticación existente de Pi y devuelve JSON validado con ruta recomendada (`simple`, `task`, `sdd` o `clarify`), confianza cualitativa, razones, áreas e incógnitas. Utiliza una sesión aislada en memoria sin herramientas, skills, MCP ni instrucciones del proyecto. Envía la solicitud al proveedor y consume uso del modelo. Si falla la evaluación, informa el error sin recomendar una ruta por defecto. No concede permisos ni ejecuta workflows. Usá el comando directo habitual para conservar el comportamiento anterior.

### Modelo específico y revisión de ruta

En la configuración de usuario o proyecto:

```json
{
  "provider": "openai",
  "model": "MODELO_GENERAL",
  "agents": {
    "classifier": { "provider": "openai", "model": "MODELO_CLASIFICADOR" }
  }
}
```

El modelo del clasificador se selecciona en este orden: `YOUR_GEAR_CLASSIFIER_MODEL`, `YOUR_GEAR_MODEL`, configuración del agente (proyecto sobre usuario), modelo general (proyecto sobre usuario) y selección por defecto. Si el agente declara proveedor, debe coincidir con el proveedor efectivo de autenticación; no se comparten claves entre proveedores ni se cambia el modo de facturación. El CLI directo no usa la configuración del clasificador.

```sh
your-gear --review-route "Agregar permisos por rol"
```

En una terminal interactiva muestra recomendación, razones e incógnitas. Permite aceptar, elegir otra ruta o cancelar; si el modelo solicita aclaración no permite saltarla. Devuelve JSON con evaluación y decisión, sin ejecutar ni persistir workflows. Para reevaluar, emitir una nueva solicitud con la aclaración. `npm run eval:classifier` ejecuta 12 casos sintéticos con el modelo real (consume uso; no se ejecuta automáticamente en CI).

### Generar y revisar un plan

```sh
your-gear --plan "Agregar reintentos HTTP con pruebas"
```

En una terminal interactiva, clasifica la solicitud y pide confirmar la ruta. Si seleccionás `task`, el harness recopila contexto local de solo lectura y solicita autorización para enviarlo al proveedor. Después, el Planner Agent genera un plan con objetivo, alcance, pasos, criterios de aceptación, riesgos, supuestos e incógnitas. Podés aprobar exactamente la versión presentada o cancelar. Si hay incógnitas bloqueantes, no se solicita aprobación. El resultado es JSON; no hay implementación, persistencia ni ejecución de herramientas. El planificador recibe únicamente el snapshot aprobado, no tiene acceso directo al filesystem.

```sh
your-gear --plan --context src/retry.ts --context docs/design.md "Agregar reintentos HTTP con pruebas"
```

El Context Engine considera archivos conocidos de la raíz (README.md, AGENTS.md y manifiestos de proyecto) y permite seleccionar hasta 8 archivos relativos al directorio actual; los explícitos tienen prioridad. Solo acepta texto UTF-8 y aplica política de lectura, exclusiones de rutas sensibles y enlaces, máximo 8000 bytes por archivo y 24000 bytes del JSON de contexto. Los archivos opcionales fuera de límites se omiten; un archivo explícito inválido detiene el flujo. Revisá la vista previa antes de autorizar el envío: la protección por nombres no detecta todos los secretos. Rechazarla cancela la planificación. El plan queda vinculado al hash de la entrada y a su versión; esto no garantiza que los archivos no cambien luego ni sustituye las políticas de herramientas.

Opcionalmente agregá `"planner": { "model": "MODELO_PLANIFICADOR" }` dentro de `agents` o definí `YOUR_GEAR_PLANNER_MODEL`. Usa las mismas reglas de precedencia y autenticación que classifier.

### Ejecutar una tarea (experimental)

```sh
your-gear --run-task --context src/retry.ts "Agregar reintentos HTTP y documentar su comportamiento"
```

Usar únicamente un workspace descartable, sin datos sensibles. Requiere terminal interactiva, recomendación y selección de `task`, autorización del contexto, plan aprobado y confirmación adicional de inicio. El harness revalida el snapshot de contexto antes de ejecutar. El Executor Agent recibe el plan y dispone únicamente de read/write/edit, cada llamada con autorización humana. No admite shell, skills, MCP ni sesiones persistidas en este modo. Opcionalmente configurar `agents.executor.model` o `YOUR_GEAR_EXECUTOR_MODEL` siguiendo la misma precedencia que classifier/planner.

La ejecución produce `awaiting-verification` y después pasa a verificación. No hay rollback ni garantía de aislamiento; un cambio puede permanecer incluso si se cancela. El plan y su hash no son permisos importables; el alcance semántico requiere supervisión humana. Para planificar sin cambios, utilizar `--plan`.

### Verificar el resultado (experimental)

```sh
your-gear --run-task --context src/retry.js --verify-test test/retry.test.mjs "Agregar reintentos HTTP y documentarlos"
```

Seleccioná hasta tres archivos de test Node (.test/.spec.js/.mjs/.cjs), existentes en el workspace cuando se ejecuten. Cada prueba se aprueba por separado tras ver su contenido y el comando exacto; el modelo no puede proponer comandos ejecutables automáticamente. Se ejecutan mediante Node sin shell, con timeout y límite de salida. **Un test puede ejecutar código arbitrario y tener efectos fuera del workspace**, acceder al entorno y crear procesos; revisá también sus imports. Solo usar código confiable en workspaces descartables.

El harness observa el snapshot de contexto posterior y los resultados de los procesos. Tras autorizar el envío de esa evidencia, un Verifier Agent independiente evalúa cada criterio del plan. Opcionalmente configurar `agents.verifier.model` o `YOUR_GEAR_VERIFIER_MODEL`. El reporte del executor no prueba que un criterio se cumpla. El estado `accepted` requiere pruebas seleccionadas con código 0, sin salida truncada ni errores del executor, criterios respaldados y aceptación humana final. Sin tests o con evidencia insuficiente, devuelve `inconclusive`. Código 0 no significa por sí solo que se hayan ejecutado pruebas relevantes. Se verifica solo el contexto seleccionado, no todo el repositorio. La salida incluye estados de tests y criterios, no los extractos completos de stdout/stderr. El flujo con modelo real sigue pendiente de aceptación.

### Registrar y consultar workflows (experimental)

```sh
your-gear --run-task --record --context src/retry.js --verify-test test/retry.test.mjs "Agregar reintentos HTTP y documentarlos"
your-gear workflows
your-gear workflow UUID
```

`--record` debe ir inmediatamente después de `--run-task`. Activa un registro local de eventos con identificador UUID mostrado al inicio. Guarda etapas, digests del contexto y plan, respuestas de aprobación, contadores y estados de pruebas/verificación, no texto del prompt, contenido de archivos, respuestas del modelo, argumentos de herramientas ni salidas de pruebas. No guarda el plan completo. Se almacena en `~/.your-gear/workflows/<hash del workspace>/<UUID>.jsonl` sin cifrado, con permisos dependientes del sistema operativo. El registro es optativo.

Los comandos de consulta funcionan sin modelo ni credenciales y solo leen registros del directorio de trabajo actual. `complete: false` indica que falta cierre, no que el proceso esté necesariamente detenido. `effectsMayHaveOccurred: true` advierte que se alcanzó una fase con posibles modificaciones o pruebas. La consulta no reanuda ni ejecuta tareas. Para recuperar un registro sin cierre, revisá primero el proyecto y usá el comando de recuperación guiada. No repitas a ciegas operaciones tras una interrupción. Los permisos anteriores no se reutilizan. La consulta rechaza registros dañados sin modificarlos. No constituye una auditoría inmutable, y no hay limpieza automática.

### Recuperar un workflow sin cierre (experimental)

```sh
your-gear --recover UUID --context src/retry.js --verify-test test/retry.test.mjs "Completar solo el trabajo pendiente descrito aquí"
```

Seleccioná el UUID del workspace actual. Confirmá que la ejecución anterior y sus descendientes terminaron y que inspeccionaste los cambios que quedaron. El CLI no puede comprobarlo de manera infalible; no hay lock global del workspace. Si hubo posibles efectos, se exige al menos un archivo de contexto explícito. Se requiere describir el trabajo restante, porque el journal no contiene el prompt o plan completos.

La recuperación crea un UUID nuevo con vínculo al registro anterior, vuelve a clasificar y planificar con contexto actual, y exige todas las aprobaciones de nuevo. No reproduce comandos, no restaura permisos ni modifica el journal anterior. Si este cambia, se impiden nuevas operaciones al revalidarlo. Una tarea cerrada (incluidas las canceladas con Ctrl+C) no se recupera con este comando: para retomar trabajo, iniciá una solicitud nueva. No hay rollback automático ni garantía de idempotencia semántica; revisá el alcance de cada cambio. Ver [aceptación manual del Hito 3](docs/spikes/milestone-3-acceptance.md).

### Consultar Agent Memory (experimental, opcional)

Instalá YTK por separado siguiendo su [guía](https://github.com/lucasjaviluna/your-team-knowledge/blob/main/docs/agent-memory-native-consumer-guide.md), inicializá el proyecto y comprobá su base. En `~/.your-gear/memory.json` (configuración de usuario, no del repo) registrá el workspace con su ruta canónica exacta. Ejemplo para Linux, adaptar rutas a la instalación:

```json
{
  "workspaces": {
    "/home/dev/proyecto": {
      "provider": "ytk",
      "command": "/home/dev/bin/ytk-memory",
      "project": "proyecto",
      "database": "/home/dev/proyecto/.ytk-memory/ytk-memory.sqlite"
    }
  }
}
```

```sh
your-gear memory status
your-gear memory list
your-gear memory search "reintentos HTTP"
your-gear memory get ID
```

Las rutas de ejecutable y base deben ser absolutas y existentes. Opcionalmente indicar `area`; si se omite, YTK resuelve su área según su propia configuración. El proceso se inicia tras confirmación interactiva, sin LLM. Puede migrar la base al abrirla y no es sandbox: usar binario confiable. Sin configuración para ese workspace, status devuelve disabled. Por ahora solo consulta, no guarda memorias ni las incorpora a prompts; el adaptador de sesiones y escrituras prepara el siguiente incremento. Los workflows actuales siguen independientes de YTK.

### Continuar una sesión

Las ejecuciones son efímeras por defecto. Para guardar una conversación y luego continuar la más reciente del mismo directorio de trabajo:

```sh
node /ruta/a/your-gear/src/cli.ts --persist "Recordá la palabra faro"
node /ruta/a/your-gear/src/cli.ts --continue "¿Qué palabra te pedí recordar?"
```

`--continue` informa un error si no existe una sesión guardada para ese workspace. Pi guarda los mensajes y resultados de herramientas en archivos JSONL bajo `~/.your-gear/sessions/`, separados por ruta de workspace. Pueden contener información sensible y no están cifrados por Your Gear; usá un workspace descartable para la prueba. El usuario reportó que recuperó contexto después de cancelar una generación y un comando en espera; una prueba puntual no garantiza la cancelación de todos los procesos ni revierte efectos ya realizados.

### Seleccionar una skill

Para usar una skill confiable del workspace, indicá explícitamente su archivo `SKILL.md` antes del prompt:

```sh
your-gear --skill ./skills/ejemplo/SKILL.md "Aplicá la skill a esta tarea"
```

Solo se carga la skill indicada. La ruta debe estar dentro del workspace y fuera de rutas protegidas; se rechazan enlaces que salgan del workspace. La skill aporta instrucciones al modelo y las herramientas siguen sujetas a la política y aprobación normales. Revisá el contenido antes de seleccionarla: el proceso no es un sandbox. Para continuar una sesión con esa skill, indicá `--skill` de nuevo junto con `--continue`.

### MCP experimental (stdio local)

MCP está deshabilitado por defecto. Para seleccionar un único servidor confiable, registralo en `~/.your-gear/mcp.json` (no se consulta configuración MCP del proyecto). Ejemplo para adaptar a rutas absolutas reales del equipo:

```json
{
  "example": {
    "command": "/absolute/path/to/node",
    "args": ["/absolute/path/to/trusted-server.js"],
    "tools": ["search"]
  }
}
```

```sh
your-gear --mcp example "Usá la herramienta search"
```

Se exige aprobación del arranque antes de cargar la extensión y aprobación de cada llamada a un nombre exacto permitido. Sin TTY el CLI rechaza MCP antes de cargar configuración o autenticar. No se admiten transportes remotos, env ni auto-descubrimiento de servidores. El servidor puede tener efectos propios al iniciarse, heredar el entorno del proceso y acceder fuera del workspace: **no es un sandbox**. No uses servidores no confiables ni secretos en argumentos. La salida del servidor puede contener datos sensibles; revisá el log MCP de Pi y la persistencia antes de utilizar datos reales. Al continuar una sesión, volvé a seleccionar y autorizar el servidor. Las aprobaciones se serializan. Ctrl+C cancela las aprobaciones pendientes, la espera de registro de herramientas y bloquea nuevas llamadas a través del gate; el CLI solicita abortar la sesión y ejecuta su cierre MCP. No garantiza interrumpir la inicialización interna del SDK, detener procesos descendientes ni deshacer efectos.

Las opciones se indican antes del prompt y se rechazan si son desconocidas. Si el prompt comienza con un guion, usá `--` para separar las opciones del texto: `node src/cli.ts -- "--texto literal"`.

Al reanudar, si el archivo más reciente contiene JSONL inválido o no pertenece al workspace, el CLI informa el problema y no descarta líneas ni cambia a una sesión anterior. Si el directorio o archivo no se puede leer, informa un error de acceso. Conservá una copia antes de intentar reparar una sesión dañada.

La carpeta de sesiones nueva se solicita con permisos `0700` en sistemas POSIX, sujetos al sistema y a la configuración existente; Pi crea los archivos usando los permisos predeterminados del proceso. En Windows el control de acceso depende de las ACL heredadas. Your Gear no verifica ni ajusta ACL existentes: revisá los permisos de `~/.your-gear` si compartís el equipo. Las sesiones pueden incluir el historial completo, rutas y resultados de herramientas; el hash del directorio no cifra esos datos ni los anonimiza.

### Modo API key opcional

El uso de API **no** es un fallback automático: requiere habilitarlo deliberadamente y puede facturarse por separado.

```sh
export YOUR_GEAR_AUTH_MODE=api-key
export YOUR_GEAR_PROVIDER=openai
export YOUR_GEAR_MODEL=MODELO_DISPONIBLE
export YOUR_GEAR_API_KEY=CLAVE_API_AUTORIZADA
node src/cli.ts "Hola"
```

En PowerShell, definir variables con `$env:NOMBRE='valor'`. No publicar, compartir ni versionar secretos. La sesión de Pi para ChatGPT no autoriza reutilizar tokens Claude.ai: **Claude Pro/Max por OAuth no se ofrece a través de este SDK de terceros**; un adaptador separado para el binario oficial Claude Code queda sujeto a sus condiciones.

## Seguridad

Las lecturas se restringen de manera conservadora al workspace; las escrituras y comandos shell requieren confirmación interactiva y se deniegan en modos sin TTY. El usuario reportó pruebas reales de las herramientas habilitadas en Windows. **El prototipo no es un sandbox**; las skills y MCP requieren selección explícita. Usar proyectos descartables para el smoke.

El CLI informa en stderr el modo de sesión, el resultado de cada solicitud de aprobación y cuándo una herramienta integrada se solicita, se bloquea o finaliza, sin registrar argumentos ni resultados en esa traza. La solicitud de aprobación muestra la ruta y el contenido propuesto para escrituras, los textos a reemplazar y propuestos para ediciones, o el comando para shell. Los textos se muestran escapados y pueden incluir información sensible. Las sesiones persistidas pueden contener el detalle de las herramientas.

## Documentación

- [Referencias técnicas](docs/references.md)
- [Visión](docs/vision.md)
- [Arquitectura](docs/architecture.md)
- [Evaluación tecnológica](docs/tech-stack.md)
- [ADR-002: autenticación autorizada](docs/decisions/ADR-002-model-auth.md)
- [Hito 0: seguimiento](docs/milestones/milestone-0.md)
- [Hito 1: seguimiento](docs/milestones/milestone-1.md)
- [Hito 2: seguimiento](docs/milestones/milestone-2.md)
- [Aceptación del Hito 2](docs/spikes/milestone-2-acceptance.md)
- [Hito 3: diseño inicial](docs/milestones/milestone-3.md)
- [Smoke manual en Windows](docs/spikes/manual-smoke-windows.md)
- [Roadmap](docs/roadmap.md)

## Objetivos

Núcleo pequeño, interfaces justificadas, herramientas con human-in-the-loop, CLI primero, sesiones recuperables y providers autorizados. Skills y MCP tienen soporte inicial; TUI y workflows llegarán por hitos, sin sobreingeniería. [Your Harness v0](https://github.com/lucasjaviluna/your-harness-v0) y [agent-harness-lab](https://github.com/lucasjaviluna/agent-harness-lab) son referencias técnicas; no se copia su arquitectura automáticamente.

## Licencia

Por definir antes de distribuir públicamente.
