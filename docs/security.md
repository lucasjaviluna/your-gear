# Seguridad y ejecución — principios iniciales

**Estado:** política conceptual Hito 0; falta implementación y pruebas.

## Modelo de amenazas mínimo
- Prompt injection a través de archivos, instrucciones y herramientas.
- Comandos destructivos, escrituras fuera de workspace y accesos a credenciales.
- Herramientas de extensión/MCP que no respeten permisos.
- Secretos expuestos en logs, trazas o commits.
- Fallos de cancelación, sesiones mezcladas y reintentos que repitan operaciones.

## Reglas de diseño
- La política se aplica por código confiable, *antes* de cada operación con efecto.
- Denegar por defecto toda operación sensible sin decisión explícita; también en modo headless.
- Mostrar comando, argumentos, ruta/cwd y efectos previstos al solicitar aprobación.
- No confiar en la descripción de la herramienta ni en el razonamiento del LLM como mecanismo de seguridad.
- La inspección de workspace debe considerar rutas absolutas, `..`, symlinks y variaciones de Windows.
- Cancelaciones y timeouts deben ser probados; no basta con ocultar UI.
- Trazas sin secrets, con ID de sesión/operación y resultado de aprobación.
- Evaluar aislamiento de procesos para comandos de alto riesgo: permiso humano no equivale a sandbox.

## Pruebas mínimas requeridas para Hito 1
- Deny de escritura y shell → ningún efecto.
- Aprobación granular y por operación, no aprobación global implícita.
- Path traversal fuera de cwd denegado.
- Extensión que intenta ejecutar tool sensible → gate ejecutado.
- Cancelación y reintento sin duplicar escrituras.
- No aparecer secretos en logs y mensajes de error.
