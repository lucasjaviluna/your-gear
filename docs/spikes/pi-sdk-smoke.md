# Pi SDK: verificación incremental

**Estado al 2026-11-22:** política local verificada, SDK Pi en ejecución real **pendiente**.

## Verificaciones realizadas

- Entorno local: Linux, Node v22.16.0; tests con `node --experimental-strip-types --test test/*.test.ts`: **17/17 OK**.
- Cobertura: rutas del workspace, .env/credenciales, symlinks, aprobaciones, manejo de excepciones, gate con ejecutor simulado y validación de configuración.
- CLI: se comprobó salida de uso sin prompt y rechazo explícito por versión Node incompatible (usando `--experimental-strip-types`).
- `npm install`: no ejecutado por imposibilidad de resolver `registry.npmjs.org` desde este entorno.
- `npm run typecheck`: pendiente por dependencias no instaladas. El nuevo workflow CI intenta ejecutar ambas verificaciones.

## Integración externa: pendientes

1. Verificar que el SDK publicado `@earendil-works/pi-coding-agent@1.6.0` puede instalarse (la etiqueta existe en el repositorio upstream, no hay instalación real local).
2. Comprobar que el hook `tool_call` se ejecuta antes de **cada** operación, incluyendo posibles herramientas registradas por extensiones.
3. Test de streaming, cancelación, error de proveedor, y reanudación de sesiones; el prototipo actual usa `SessionManager.inMemory()`.
4. Ejecutar pruebas reales en Windows PowerShell y Node >=22.19.0.

## Limitaciones de seguridad pendientes

Este prototipo **no es un sandbox**. Los comandos de shell aprobados pueden acceder al sistema host, fuera del workspace. La validación de path tiene riesgo TOCTOU y no equivale a aislamiento OS. La lectura permitida no detecta todos los secretos posibles. El gate simulado verifica la integración del callback, **no** prueba la ejecución interna de Pi.

Además, falta comprobar que una extensión que falle no pueda dejar el agent runtime activo con políticas incompletas. Las extensiones externas están deshabilitadas deliberadamente en el MVP.

## Cómo ejecutar cuando estén disponibles dependencias

```sh
npm install --ignore-scripts
npm run typecheck
npm test
# Sólo con credenciales autorizadas por el proveedor:
export YOUR_GEAR_PROVIDER=openai
export YOUR_GEAR_MODEL=MODELO_DISPONIBLE
export YOUR_GEAR_API_KEY=CLAVE_AUTORIZADA
npm start -- "Lee README.md sin modificar archivos"
```

En PowerShell, establecer variables con `$env:NOMBRE='valor'`.

No está completo ADR-001 ni el Hito 0 hasta verificar la integración de punta a punta.
