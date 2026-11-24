# Seguridad y ejecución — política vigente y límites

**Corte:** main tras PR #22, 2026-11-24. El prototipo NO es un sandbox ni un sistema DLP. Usar workspaces descartables y código confiable mientras estén pendientes las pruebas reales de Hitos 2 y 3. CI multiplataforma verifica contratos, fixtures y paquete, no aislamiento de OS ni inferencia real.

## Fronteras de autorización

| Vía | Control vigente | Límites |
| --- | --- | --- |
| Directo read | Política de ruta, lectura dentro del workspace | No detecta todos los secretos; sin gate interactivo por lectura |
| Directo write/edit/bash | Vista previa y autorización por operación, sin TTY se deniega | Bash puede afectar fuera del workspace y heredar entorno |
| Skill explícita | Validación de ruta antes de cargar; no autodescubrimiento | Texto no confiable, no elimina la necesidad de gate |
| MCP directo | Registro de usuario, gate de arranque, allowlist exacta y aprobación por llamada | El servidor puede iniciar efectos fuera de las tools, heredar entorno y crear descendientes |
| Clasificador / planner / verifier | Sesiones sin herramientas; validación de JSON | No garantiza veracidad de razonamiento ni ausencia de inyección |
| Contexto task | Selección acotada, vista previa y consentimiento de envío | Archivos seleccionados únicamente, no DLP ni inventario completo |
| Executor task | Ruta task recomendada y elegida, plan/entrada y snapshot vigentes, gate de inicio y por read/write/edit | Alcance semántico supervisado, no enforcement exhaustivo; efectos previos pueden persistir |
| Tests task | Archivo Node explícito, preview, gate, relectura, timeout y límite de salida | Código/imports arbitrarios, red, filesystem, entorno y procesos; no sandbox |
| Verificación | Consentimiento de envío de evidencia, esquema por criterio y aceptación final humana | Exit-zero no prueba cobertura ni relevancia; evaluación parcial |
| YTK | Registro exclusivo del usuario, scope, autorización de inicio; checkpoints opt-in con preview | Binario confiable puede migrar DB y acceder a recursos; sin aprobación por checkpoint tras consentir |
| Recuperación | Journal del mismo workspace, referencia exacta, revisión humana y nuevos gates | Sin lock global, rollback, replay ni garantía de que el padre dejó de ejecutar |

El gate debe ocurrir antes de efectos. Una recomendación, un hash, una memoria o una aprobación histórica no son permisos. No ampliar alcance por salida del modelo. Se excluyen rutas protegidas conocidas, entre ellas .git, .ssh, .pi, .your-gear, .ytk-memory, .ytk-memory.json, .env y archivos de credenciales conocidos. El Context Engine añade restricciones sobre archivos ocultos, enlaces, hardlinks, tamaños y tipos. El control de paths tiene riesgo TOCTOU y no cubre todos los alias o secretos. No usar un proceso MCP no confiable.

## Información sensible y autenticación

- Modo suscripción usa Pi ModelRuntime; API key solo opt-in por entorno, sin fallback. Ver [ADR-002](decisions/ADR-002-model-auth.md). La configuración de modelos del proyecto no concede autorización comercial ni activa modo API.
- El prompt se envía al proveedor seleccionado; las vistas previas de contexto y evidencia pueden incluir datos sensibles. Los errores redactados y trazas omiten argumentos/resultados en rutas específicas, no garantizan eliminar todos los secretos. Revisar terminal, logs, capturas y permisos.
- Las sesiones Pi persistidas pueden guardar conversaciones y tool results sin cifrado. El journal registra metadatos y referencias, no prompts/código crudos; hashes no anonimizan ni constituyen firma. Checkpoints YTK pueden contener datos sensibles derivados del plan y rutas; revisar preview, no almacenar secretos. No hay retención automática ni auditoría inmutable. No incluir DBs, auth, logs ni secretos en git.
- YTK recibe solamente operaciones del adaptador, no herramientas concedidas al LLM. Proyecto y área son alcance lógico, no aislamiento OS. Verifica ID/subjectKey/digest/scope y lifecycle; si falta memoria válida, usar recuperación manual. No reintentar automáticamente una escritura incierta. Puede quedar un checkpoint huérfano ante una caída entre SQLite y JSONL. La memoria recuperada se revisa antes de enviarla al LLM; no se confía como estado actual.

## Fallos y cancelación

Se usan señales de cancelación, aprobaciones serializadas y bloqueos después de rechazo/cancelación. Código 130 cuando se procesa cancelación, no se garantiza detener todos los descendientes o revertir efectos. Sin rollback. No se acepta una tarea sin evidencia respaldada y revisión humana. Un workflow sin cierre puede estar activo o haber fallado su registro: comprobar procesos antes de recuperar. Los archivos dañados no se reparan automáticamente. Sin lock del workspace, otras ejecuciones podrían intervenir.

## Evidencia y deuda de validación

- Hitos 0/1: usuario reportó Windows con inferencia, streaming, herramientas, rutas externas, no-TTY, cancelación y continuidad; no prueba exhaustiva ni modelo/Node exactos registrados. Ver [registro histórico](spikes/manual-smoke-windows.md).
- Hito 2: CI/fixtures cubren arranque MCP, gates, cancelación y paquete instalado; [aceptación manual](spikes/milestone-2-acceptance.md) pendiente.
- Hito 3: CI de PR #22 [exitoso](https://github.com/lucasjaviluna/your-gear/actions/runs/45504735165) en Linux, Windows y macOS (typecheck, tests, build/pack/install/smoke); modelos simulados y servidor MCP fixture. [Aceptación manual](spikes/milestone-3-acceptance.md), evaluación semántica y smoke con binario YTK real pendientes.
- Antes de producción: aislamiento de procesos/filesystem, pruebas adversariales de rutas, exposición y concurrencia, políticas de datos/retención, compatibilidad real por plataforma, cancelación de procesos y revisión de logs. No declarar garantía integral a partir de CI.
