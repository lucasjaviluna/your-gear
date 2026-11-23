# Pi SDK — evidencia incremental

**Actualización:** 2026-11-23. El Hito 0 y ADR-001 siguen abiertos.

## Pruebas automatizadas

- Hito base: GitHub Actions en `main` pasó `npm install`, `typecheck` y **17/17** tests sobre Node 22.19.0.
- PR #2: modo `pi-subscription` y `api-key`, selección segura de modelo, ausencia de fallback y pruebas unitarias de resolución. Consultar el workflow CI del PR para resultado concreto.
- Las pruebas de selección son simuladas, **no** requieren inferencia, navegador ni tokens.
- El código de Your Gear no lee `auth.json` directamente; entrega la responsabilidad de credenciales a `ModelRuntime` de Pi.
- En modo de suscripción solo se habilita `openai`. Se requiere una sesión Pi válida con **Sign in with ChatGPT**.

## Pendientes

- Smoke manual Windows con un usuario autenticado por el flujo oficial de Pi: [guía](manual-smoke-windows.md).
- Validar streaming, errores, cancelación y aprobación/denegación **dentro del loop real de Pi**.
- Probar persistencia y reanudación (el SDK sigue configurado con `SessionManager.inMemory`).
- Verificar exhaustivamente los límites de permisos de extensiones y MCP cuando se activen.

## Advertencia

El gate actual no es un sandbox. La verificación de rutas presenta una ventana TOCTOU, los comandos shell aprobados pueden acceder fuera del workspace y una lectura aparentemente permitida puede exponer un secreto no incluido en la lista. No ejecutar sobre proyectos reales con datos sensibles para validar el prototipo.
