# Pi SDK — evidencia incremental

**Actualización:** 2026-11-23. Hito 0 y ADR-001 aceptados para el alcance validado; ver [seguimiento](../milestones/milestone-0.md).

## Pruebas automatizadas

- Hito base: GitHub Actions en `main` pasó `npm install`, `typecheck` y **17/17** tests sobre Node 22.19.0.
- PR #2: modo `pi-subscription` y `api-key`, selección segura de modelo, ausencia de fallback y pruebas unitarias de resolución. Consultar el workflow CI del PR para resultado concreto.
- Las pruebas de selección son simuladas, **no** requieren inferencia, navegador ni tokens.
- El código de Your Gear no lee `auth.json` directamente; entrega la responsabilidad de credenciales a `ModelRuntime` de Pi.
- En modo de suscripción solo se habilita `openai`. Se requiere una sesión Pi válida con **Sign in with ChatGPT**.

## Pendientes

- El usuario reportó exitosas las pruebas manuales de streaming, errores, cancelación, herramientas, rutas externas y escritura sin TTY en Windows: [registro y guía](manual-smoke-windows.md). No se registraron modelo ni versión exacta de Node.
- Probar persistencia y reanudación (el SDK sigue configurado con `SessionManager.inMemory`).
- Verificar exhaustivamente los límites de permisos de extensiones y MCP cuando se activen.

## Advertencia

El gate actual no es un sandbox. La verificación de rutas presenta una ventana TOCTOU, los comandos shell aprobados pueden acceder fuera del workspace y una lectura aparentemente permitida puede exponer un secreto no incluido en la lista. No ejecutar sobre proyectos reales con datos sensibles para validar el prototipo.

## Observabilidad del primer smoke ChatGPT

Se observó en Windows que el CLI imprimía `Your Gear: openai/chat-latest (pi-subscription)` pero no imprimía texto. **No está confirmada la causa de proveedor**: la versión previa de Your Gear ignoraba el evento `message_end` y el campo `stopReason/errorMessage` de Pi.

Se agregó `src/response-output.ts` y su suite aislada:
- Imprime deltas por streaming sin duplicarlos.
- Recupera el texto final si `text_delta` no llegó.
- Muestra errores redactados de `stopReason=error`.
- Distingue cancelación, respuesta truncada y finalización sin contenido.
- Falla con código distinto de cero ante una respuesta vacía.

Se verificó `33/33` tests y typecheck en GitHub Actions del PR #2 (run `45196845910`). Luego el usuario reportó inferencia real exitosa en Windows. Una verificación local posterior pasó 35 tests y typecheck; ese resultado no implica CI para los cambios posteriores.
