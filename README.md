# Your Gear

**Your Gear** es un harness de agentes de IA configurable y extensible con una experiencia CLI terminal-first.

> **Estado:** Hito 0 completado para el alcance validado. Hay un prototipo con Pi SDK, política de herramientas y smoke real reportado en Windows; la persistencia y reanudación corresponden al Hito 1.

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

### Continuar una sesión

Las ejecuciones son efímeras por defecto. Para guardar una conversación y luego continuar la más reciente del mismo directorio de trabajo:

```sh
node /ruta/a/your-gear/src/cli.ts --persist "Recordá la palabra faro"
node /ruta/a/your-gear/src/cli.ts --continue "¿Qué palabra te pedí recordar?"
```

`--continue` informa un error si no existe una sesión guardada para ese workspace. Pi guarda los mensajes y resultados de herramientas en archivos JSONL bajo `~/.your-gear/sessions/`, separados por ruta de workspace. Pueden contener información sensible y no están cifrados por Your Gear; usá un workspace descartable para la prueba. El usuario reportó que recuperó contexto después de cancelar una generación y un comando en espera; una prueba puntual no garantiza la cancelación de todos los procesos ni revierte efectos ya realizados.

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

Las lecturas se restringen de manera conservadora al workspace; las escrituras y comandos shell requieren confirmación interactiva y se deniegan en modos sin TTY. El usuario reportó pruebas reales de las herramientas habilitadas en Windows. **El prototipo no es un sandbox**; extensiones y MCP requieren validación propia antes de habilitarse. Usar proyectos descartables para el smoke.

El CLI informa en stderr el modo de sesión, el resultado de cada solicitud de aprobación y cuándo una herramienta integrada se solicita, se bloquea o finaliza, sin registrar argumentos ni resultados en esa traza. La solicitud de aprobación puede mostrar la ruta o el comando para que el usuario pueda revisarlos. Las sesiones persistidas pueden contener el detalle de las herramientas.

## Documentación

- [Visión](docs/vision.md)
- [Arquitectura](docs/architecture.md)
- [Evaluación tecnológica](docs/tech-stack.md)
- [ADR-002: autenticación autorizada](docs/decisions/ADR-002-model-auth.md)
- [Hito 0: seguimiento](docs/milestones/milestone-0.md)
- [Smoke manual en Windows](docs/spikes/manual-smoke-windows.md)
- [Roadmap](docs/roadmap.md)

## Objetivos

Núcleo pequeño, interfaces justificadas, herramientas con human-in-the-loop, CLI primero, sesiones recuperables y providers autorizados. Skills, MCP, TUI y workflows llegarán por hitos, sin sobreingeniería. El laboratorio complementario [agent-harness-lab](https://github.com/lucasjaviluna/agent-harness-lab) sirve de referencia técnica, no se copia su arquitectura automáticamente.

## Licencia

Por definir antes de distribuir públicamente.
