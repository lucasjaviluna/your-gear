# Your Gear

**Your Gear** es un harness de agentes de IA configurable y extensible con una experiencia CLI terminal-first.

> **Estado:** Hito 0 en progreso. Hay un prototipo de runtime, política de herramientas y pruebas automatizadas; falta validar la ejecución real con un modelo y terminar el ADR de runtime.

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

Por defecto se usa `YOUR_GEAR_AUTH_MODE=pi-subscription`, el proveedor `openai` y el primer modelo disponible en la sesión de Pi. Para fijar uno, definir `YOUR_GEAR_MODEL` con un ID de `models`. El CLI informa el modelo seleccionado. El uso está sujeto a los límites y condiciones de la suscripción y al permiso aprobado en el login.

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

Las lecturas se restringen de manera conservadora al workspace; las escrituras y comandos shell requieren confirmación interactiva y se deniegan en modos sin TTY. **El prototipo no es un sandbox** y la interceptación real de todas las herramientas aún requiere pruebas con Pi en ejecución. Usar proyectos descartables para el smoke.

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
