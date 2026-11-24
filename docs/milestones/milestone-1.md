# Hito 1 — Vertical slice funcional

**Estado:** COMPLETADO para el alcance validado; PR #7 fusionado en `main`.

## Evidencia

- El usuario confirmó en Windows una prueba completa en un workspace temporal: lectura y edición de un archivo, inspección y aprobación del cambio, comprobación del resultado y recuperación de la palabra y el contexto mediante `--continue`.
- En pruebas anteriores confirmó lectura y escritura dentro del workspace, bloqueo de operaciones sobre un archivo externo y mensajes de herramientas, sesión y aprobación. También recuperó contexto después de cancelar una generación y un comando en espera; en esa prueba el archivo esperado no se creó.
- La vista previa de aprobación muestra el contenido propuesto para `write` y los textos anteriores y propuestos para cada sustitución de `edit`, escapados. Las pruebas automatizadas cubren estas descripciones y el gate. No se registraron modelo ni versión exacta de Node de la prueba manual.
- En la verificación local de los cambios pasaron 44 tests y typecheck. El CI del PR #7 finalizó correctamente y el PR se fusionó en `main`.

## Riesgos y límites conocidos

- El prototipo no es un sandbox: un comando shell aprobado puede tener efectos fuera del workspace. La comprobación de rutas de las herramientas no garantiza aislamiento frente a cambios concurrentes del sistema de archivos.
- La cancelación observada es evidencia de casos puntuales; no garantiza detener todos los procesos ni deshacer efectos ya ocurridos.
- Las sesiones JSONL pueden contener conversaciones y resultados de herramientas sin cifrar. Sus permisos dependen del sistema; las ACL heredadas en Windows y los permisos en instalaciones reales no fueron verificados.
- La vista previa puede mostrar contenido sensible y textos largos; usa cadenas escapadas, no un diff con contexto. La traza básica omite argumentos y resultados, pero no constituye una auditoría completa.
- Las pruebas manuales reportadas fueron en Windows. No se afirma validación real en Linux o macOS; la distribución automatizada se incorporó en Hito 2 y sigue vigente en CI #22; inferencia real en Linux/macOS pendiente.

## Seguimiento posterior

Este hito describe la sesión conversacional del modo directo. Desde Hito 3, el estado de workflow se registra por separado y la recuperación asistida utiliza memoria YTK optativa; no se equipara `--continue` con `--recover`. Ver [arquitectura vigente](../architecture.md).
