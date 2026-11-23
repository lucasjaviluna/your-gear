# Seguridad y ejecución — principios iniciales

**Estado:** política inicial implementada para las herramientas habilitadas; no es un sandbox.

El usuario reportó pruebas manuales en Windows de bloqueo de rutas externas y escritura sin TTY. Las pruebas automatizadas cubren el gate y un proceso sin TTY, no todas las vías de ejecución del SDK. Las garantías no se extienden a futuras extensiones/MCP.

## Riesgos conocidos
- La comprobación de rutas puede quedar desactualizada antes del uso (TOCTOU); la lista de rutas protegidas no cubre todos los secretos.
- Un comando shell aprobado puede acceder o modificar recursos fuera del workspace.
- La redacción de errores es parcial; no garantiza eliminar todos los secretos.
- Las pruebas reales reportadas son de Windows; macOS y Linux requieren validación. La disponibilidad de modelos depende de Pi, proveedor y cuenta.
- Persistencia, aislamiento de sesiones y comportamiento ante cancelación durante efectos requieren pruebas adicionales en Hito 1.

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
