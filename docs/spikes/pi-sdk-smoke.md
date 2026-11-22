# Pi SDK smoke — implementación inicial

**Estado:** prototipo preparado; política verificada localmente; integración real con Pi **NO ejecutada** (2026-11-22).

## Código
- `src/cli.ts`: crear sesión con Pi SDK, streaming, hooks, aprobación interactiva; sesión en memoria.
- `src/policy.ts`: decisión pura y autorización fail-closed.
- `test/policy.test.ts`: pruebas sin acceso a modelos ni red.

## Reproducción
Se requiere Node >= 22.19.0 según el paquete upstream, npm y una API key permitida por el proveedor.

```sh
npm install
npm test
npm run typecheck
# En PowerShell, establecer variables con $env:NOMBRE="valor".
export YOUR_GEAR_PROVIDER=openai
export YOUR_GEAR_MODEL=MODELO_VALIDO_DEL_PROVEEDOR
export YOUR_GEAR_API_KEY=API_KEY_REAL_NO_COMMITEAR
npm start -- "Describe README.md; no modifiques archivos"
```

**No usar OAuth de Claude.ai Pro/Max en este harness de terceros**; seguir `ADR-002`.

## Evidencia local
- Entorno de evaluación: Linux, Node v22.16.0 (inferior al requisito de Pi), TypeScript 5.8.3 global.
- `node --experimental-strip-types --test test/*.test.ts`: **9/9 OK**.
- Smoke de CLI sin argumentos: mensaje de uso correcto.
- `tsc --noEmit`: **no ejecutable completamente**; faltan `@types/node` y dependencias npm.
- `npm install`: **no realizado**, sin acceso a registry npm.
- Prompt real, streaming Pi, tool gate integrado, cancelación y persistencia: **sin verificar**.
- Versión `1.6.0` obtenida del `package.json` del repositorio upstream; publicación en npm no verificada desde este entorno.

## Seguridad y límites
- Las herramientas `read`, `write`, `edit`, `bash` son allowlist explícita. No se cargan extensiones globales ni recursos del proyecto por defecto.
- `read` se admite solo en rutas canónicas del workspace que no correspondan a secretos protegidos.
- `write`, `edit` y `bash` requieren respuesta `s`; en modo sin TTY se rechazan.
- Herramientas desconocidas, escapes de workspace y errores de validación se rechazan.
- El gate usa el evento Pi `tool_call` pre-ejecución, pero falta demostrar con tests de integración que se invoca siempre.
- Los comandos shell aprobados **no están aislados**; pueden modificar o leer fuera del workspace. No considerar el spike sandbox de seguridad.
- Existe riesgo TOCTOU entre validación de path y ejecución. Reforzar con mecanismos en la operación real o aislamiento antes de ofrecer garantías de producción.
- La sesión es deliberadamente **en memoria** en este primer spike; reanudación será una prueba aparte.

## Próxima validación
1. Ejecutar `npm install && npm run typecheck && npm test` en Node compatible.
2. Realizar prueba de prompt/streaming con API key autorizada (no commitear).
3. Simular `write`/shell sin autorización y verificar ausencia de efectos (integración Pi).
4. Verificar en Windows PowerShell, errores, Ctrl+C, persistencia y reanudación.
5. Registrar resultados reales y decidir ADR-001.
