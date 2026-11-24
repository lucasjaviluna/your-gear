# Hito 3 — Workflows con humanos en el circuito

**Estado (2026-11-24):** 3.A–3.D.4 integrados con CI exitoso, incluidos PR #22 [run 45504735165](https://github.com/lucasjaviluna/your-gear/actions/runs/45504735165); aceptación real pendiente. 3.E sigue pendiente. El usuario acordó diferir la aceptación manual del Hito 2; no se considera aprobada.

## Referencias y decisiones

Se revisaron los documentos de Your Harness v0 [fase 3](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/PHASE_3_ASSESSMENT.md), [fase 4](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/PHASE_4_TASKS.md) y [fase 16](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/PHASE_16_AGENT_ASSESSMENT.md). Describen recomendación de ruta, confirmación humana, clasificación asistida por modelo sin herramientas, fallback conservador y gates ante cambios de alcance. Son referencias de diseño, no evidencia de compatibilidad directa con Your Gear. Inspeccionar implementación y tests de v0 antes de reutilizar código.

## Alcance de diseño y estado

Mantener el CLI directo actual como comportamiento por defecto. Introducir workflows optativos, inicialmente sin motor declarativo genérico, subagentes ni integración obligatoria con OpenSpec.

- **simple:** cambio localizado con ejecución directa bajo el gate de herramientas existente.
- **task:** objetivo acotado, plan breve, aprobación, ejecución y verificación.
- **sdd:** cambio complejo o transversal; recomendar especificación y autorización. No iniciar OpenSpec hasta implementar y verificar su integración.
- **clarify:** objetivo/alcance decisivo ausente; aclarar antes de ejecutar.

No clasificar por longitud del prompt. Una solicitud corta sobre permisos, contratos, migraciones o seguridad puede ser compleja.

## Incrementos

| Incremento | Entrega | Criterio |
| --- | --- | --- |
| 3.A | Contrato de evaluación y agente clasificador LLM, modo análisis aislado | Respuesta validada, ninguna herramienta ni ejecución de tareas; evaluación semántica con modelo real |
| 3.B | Confirmación humana de ruta, selección configurable del clasificador y evaluación de calidad | Respuesta inválida o fallo no autoriza acciones; cancelación bloquea |
| 3.C | Ruta task con plan, gate, ejecución y verificación | Rechazo/cancelación impide ejecución; cambios de alcance invalidan aprobación |
| 3.D.1–3.D.4 | Estado, trazabilidad, recuperación guiada, adaptador YTK y checkpoints optativos | No reejecutar efectos por reanudar; distinguir verificación real de afirmaciones del modelo |
| 3.E | Evaluar integración SDD/OpenSpec opcional | Verificar necesidad y compatibilidad, diseñar gates y tests antes de activar |

Las secciones siguientes describen la evolución por incremento; las limitaciones iniciales se conservan con su contexto temporal y se actualizan cuando cambia el comportamiento. El orden se revisará con evidencia. No introducir abstracciones públicas ni persistencia adicional sin una necesidad comprobada; evaluar entradas custom de Pi antes de decidir.

## Fronteras

El clasificador recomienda, no autoriza. La confirmación del workflow no sustituye las aprobaciones de herramientas. La ejecución conserva las políticas y cancelación actuales. El contexto del repositorio y del prompt se trata como datos no confiables; no concede permisos. La ruta directa existente debe seguir funcionando sin activar workflows.

## Incremento 3.A — Agente clasificador semántico

Decisión revisada por el usuario: sustituir clasificación mediante regex y palabras clave por un LLM como única fuente de la recomendación. Se conserva la idea de rutas y gates de Your Harness v0, no su clasificación léxica ni su fallback.

- `src/assessment.ts`: contrato, prompt de sistema, validación estricta de JSON y transporte desacoplado mediante callback. El código no infiere categorías por palabras.
- `src/assessment-agent.ts`: sesión Pi independiente en memoria, sin herramientas, MCP, skills, extensiones externas, plantillas ni instrucciones del proyecto. Gate adicional deniega cualquier tool call.
- `your-gear --analyze-only "tarea"`: usa autenticación y modelo configurados, envía la solicitud al proveedor, consume uso del modelo y devuelve solo JSON validado. No admite flags de ejecución; usar `--` para texto literal.
- Evaluar intención, impacto, alcance, riesgo, reversibilidad, dependencias e incertidumbre. No inferir información del repositorio que no se haya suministrado.
- Sin fallback léxico ni ruta automática ante errores de proveedor, cancelación o respuesta inválida. La confianza cualitativa no es una probabilidad calibrada; una respuesta válida puede ser semánticamente incorrecta. Ninguna ruta concede permisos.
- Tests de contrato, errores e integración con SDK y modelo simulado; los casos semánticos se deben evaluar también con un modelo real. CI de PR #13 exitoso (run 45314703177). Evaluación con modelo real pendiente.

## Incremento 3.B — Configuración y revisión humana

- Configuración `agents.classifier` con modelo y proveedor opcional igual al proveedor efectivo; no se reutilizan claves entre proveedores. `YOUR_GEAR_CLASSIFIER_MODEL` prevalece sobre el modelo global del entorno, el modelo específico de archivos y el modelo general de archivos. Herencia usuario/proyecto por campo.
- `--review-route` exige TTY, muestra razones e incógnitas y solicita aceptar, cambiar o cancelar. `clarify` no se puede saltar. Una selección es una decisión de estrategia, no autorización de ejecución. No persiste estado ni inicia workflows.
- Tests de precedencia, rechazo de claves/configuración desconocida, revisión y cancelación; smoke de rechazo sin TTY. CI del PR #14 exitoso (run 45317184205).
- `npm run eval:classifier` ejecuta 12 ejemplos sintéticos con el modelo configurado. Reporta aciertos, errores y subclasificación de riesgos explícitos en el conjunto etiquetado. No se ejecuta en CI sin proveedor; no representa una medida general de calidad. No registra prompts ni respuestas completas del modelo. Validación real pendiente.

## Incremento 3.C.1 — Planner Agent y aprobación de plan

Se revisaron `src/plan.ts` y `tests/plan.test.ts` de Your Harness v0: se adopta la idea de versión y revisión, pero los pasos se generan semánticamente por LLM en lugar de plantillas fijas.

- `--plan "solicitud"`: clasifica, solicita decisión de ruta y genera plan únicamente si se selecciona task. No inicia executor, SDD ni herramientas. Las otras rutas terminan sin plan.
- `src/plan.ts`: contrato validado, objetivo, alcance, pasos, criterios de aceptación, riesgos, supuestos e incógnitas bloqueantes. El digest SHA-256 cubre contenido normalizado y versión; cualquier modificación invalida una aprobación anterior. No es firma ni token de autorización; no se acepta un JSON externo como permiso.
- `src/planner-agent.ts`: sesión efímera y prompt propio; reutiliza el helper concreto `tool-free-agent.ts` con el clasificador. Configuración `agents.planner` y `YOUR_GEAR_PLANNER_MODEL`, mismo proveedor autenticado.
- El plan es preliminar, no inspecciona el repositorio ni afirma verificaciones realizadas. Incógnitas bloquean aprobación; rechazo, respuesta inválida, EOF o cancelación no producen un plan aprobado.
- Tests unitarios e integración Pi con modelo simulado; smoke del paquete sin TTY. CI del PR #15 exitoso (run 45318347095); uso real pendiente. No persiste estado ni implementa revisiones interactivas del plan aún.

## Incremento 3.C.2 — Context Engine de solo lectura

Se revisaron `src/context-engine.ts` y `tests/context-engine.test.ts` de Your Harness v0. Se adopta el presupuesto de contexto y la procedencia por archivo, no la búsqueda de relevancia por coincidencia de palabras, ni un framework de providers. La recuperación semántica y memoria quedan para hitos posteriores.

- `--plan [--context archivo]...`: selecciona archivos explícitos y considera documentos y manifiestos conocidos de la raíz (AGENTS.md, README.md, package.json, tsconfig.json, pyproject.toml, go.mod, Cargo.toml). Sin recorrido recursivo, comandos shell ni selección automática de fuentes arbitrarias. La raíz es el cwd, no se asciende a otros directorios.
- Hasta 8 archivos, 8000 bytes por archivo y 24000 bytes en el JSON de entradas. Selecciones explícitas primero; archivos opcionales no disponibles, bloqueados o fuera de presupuesto se omiten; fallos explícitos abortan. No se truncan archivos. Solo UTF-8 textual y rutas relativas permitidas por política; se rechazan rutas ocultas, nombres sensibles conocidos, enlaces, hardlinks, binarios y archivos especiales.
- Antes de enviar archivos al modelo se presenta exactamente su contenido en JSON escapado. Rechazo o cancelación detienen la planificación; no se envían al clasificador. El planificador continúa sin herramientas. Los documentos son datos no confiables, no autoridad. La revisión humana no es una garantía de ausencia de secretos; la lista de nombres no constituye DLP ni sandbox. Permanecen limitaciones de carreras de filesystem.
- La salida registra rutas, tamaño y digest del snapshot (no el contenido completo del contexto). El plan incorpora el digest del mensaje enviado (solicitud, evaluación, ruta task y contexto), además del digest de versión/contenido. El cambio de entrada invalida una aprobación anterior. No es firma ni permiso importable y no verifica que el repositorio siga igual después de la lectura.
- Tests de políticas de lectura, tamaño, enlaces, selección explícita, consentimiento, cancelación y vínculo entre plan y entrada. CI del PR #16 exitoso (run 45320011615). La integración con proveedor real y revisión interactiva requieren aceptación manual.

## Incremento 3.C.3.A — Task Orchestrator y Executor Agent

- `--run-task [--context archivo]... "solicitud"` es optativo, experimental y exige terminal interactiva. No altera el CLI directo ni `--plan`. Solo continúa si tanto recomendación como decisión humana son task; no permite degradar SDD ni saltar aclaraciones.
- `task-orchestrator.ts` controla de forma determinista la secuencia: verifica ruta, aprobación de plan y digest de entrada, vuelve a recopilar el snapshot, pide autorización separada para iniciar y vuelve a comprobar plan y contexto. El CLI comprueba también el snapshot inmediatamente antes de llamar al ejecutor. No acepta permisos importados. En 3.C.3.A no persistía estado; 3.D añade journal optativo. La comprobación detecta cambios en el snapshot seleccionado, no en todo el repositorio.
- `executor-agent.ts`: sesión Pi efímera, system prompt propio, modelo configurable con `agents.executor` y `YOUR_GEAR_EXECUTOR_MODEL`. Solo read/write/edit; todas las llamadas requieren aprobación humana, incluso read (se envía al modelo). Reutiliza política de rutas y gate, revalida la decisión tras la espera. Una denegación bloquea llamadas posteriores; operaciones ya aprobadas o iniciadas pueden haber tenido efectos. No hay sandbox, rollback ni enforcement semántico del alcance; el prompt orienta al modelo y el usuario inspecciona las operaciones. No se ejecutan comandos ni se cargan MCP, skills o extensiones externas.
- La salida incluye reporte del modelo, número de llamadas bloqueadas y errores observados en eventos de herramientas. El resultado de esta fase es `awaiting-verification`, no una verificación final; 3.C.3.B añade revisión posterior. Un reporte textual no demuestra que se cumplan criterios; los errores y bloqueos se señalizan con código de salida distinto de cero. Cancelar o fallar no deshace archivos.
- Tests del orquestador (rechazo, ruta, plan/entrada alterados, contexto cambiado y cancelación), configuración y prueba con sesión Pi real y modelo simulado que intenta escribir un archivo temporal. CI del PR #17 exitoso (run 45363880799).
- Reevaluación de la deuda del Hito 2: la ruta experimental se limita a las herramientas de archivos ya ejercitadas en Windows durante Hitos 0/1 y a tests de efectos; no utiliza MCP ni shell. Probar únicamente en workspace descartable, con modelo real y revisión humana, antes de uso habitual. No se declaran aceptadas las pruebas diferidas.

## Incremento 3.C.3.B — Verifier Agent y revisión final

Se revisó [fase 8 de Your Harness v0](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/PHASE_8_VALIDATION.md): los resultados de validación deben distinguir éxito, fallo y pruebas no ejecutadas. No se traslada su infraestructura de empaquetado al workflow.

- `--run-task [--context archivo] [--verify-test archivo]... "solicitud"`: conserva gates previos. Se seleccionan explícitamente hasta tres archivos .test/.spec.js/.mjs/.cjs, sin globs ni comandos del modelo. Solo se intentan tras ejecución sin errores ni bloqueos. Cada prueba presenta el ejecutable, argumentos y contenido del archivo y requiere aprobación individual; se vuelve a leer el archivo antes de iniciar. No ejecuta otras pruebas tras un resultado distinto de exit-zero.
- `verification-evidence.ts`: ejecuta Node con `--test --test-reporter=tap` mediante execFile sin shell; timeout de 60 s, buffer 65536 bytes por flujo y extracto de 4000 caracteres de cada salida. Distingue exit-zero, failed, error, skipped y stale. Exit-zero solo afirma el código del proceso; no demuestra que haya tests relevantes ni cobertura. El código de prueba e imports pueden tener efectos arbitrarios, incluso fuera del workspace, acceder a red/entorno y crear descendientes. No hay sandbox ni garantía de detener descendientes; no usar código no confiable. Se eliminan NODE_OPTIONS, NODE_PATH, NODE_TEST_CONTEXT y NODE_V8_COVERAGE del entorno hijo; el resto se hereda.
- Se toma un snapshot posterior de los archivos de contexto seleccionados y metadatos conocidos. No es un diff completo ni un inventario de todos los archivos modificados. No garantiza que el código importado por las pruebas permanezca igual. Un fallo de lectura impide completar la verificación.
- `verification.ts`: evidencia identificada por ID, evaluación por criterio y esquema estricto. No acepta referencias inexistentes, índices repetidos o autorización inventada. El reporte del executor no cuenta como evidencia. Antes de enviar el snapshot posterior, extractos de tests y reporte al proveedor, se muestra el payload y se pide autorización. El Verifier Agent utiliza una sesión Pi independiente sin herramientas y modelo configurable mediante `agents.verifier` o `YOUR_GEAR_VERIFIER_MODEL`.
- La aceptación final es humana y limitada a la evidencia seleccionada; exige al menos un test ejecutado con exit-zero, sin truncamiento, sin errores/bloqueos del executor, todos los criterios supported y snapshot vigente. No se equipara accepted a certificación técnica de todo el repositorio. Sin pruebas, rechazo, fallos, evidencia insuficiente o cambio de snapshot no hay aceptación. El CLI conserva el reporte de ejecución y los metadatos de tests aunque falle el verificador; solo devuelve 0 si hay aceptación final. Ctrl+C devuelve 130. No hay rollback ni reintentos automáticos.
- Tests unitarios de contrato, referencias, gates y procesos reales de Node en workspace temporal, sin modelo real; smoke del paquete. CI del PR #18 exitoso (run 45367651423). Sigue siendo experimental, con pruebas reales de usuario pendientes.

## Incremento 3.D.1 — Workflow Journal y recuperación de estado

Referencia: fases 4 y 7 de Your Harness v0 (artefactos de tarea y gate de recuperación). Se revisó `src/sessions.ts` de Your Gear: SessionManager de Pi conserva conversaciones, no el ciclo de vida de un workflow que usa varias sesiones aisladas. Se conserva Pi para las sesiones y se añade un único journal de Your Gear, sin duplicar conversaciones ni incorporar una base de datos.

- Opt-in: `your-gear --run-task --record [--context archivo] [--verify-test archivo] "solicitud"`. En 3.D.1 era el único modo que creaba journal; desde 3.D.2 cada recuperación crea otro y desde 3.D.4 --memory implica registro. Se asigna un UUID y se imprime al iniciar. `~/.your-gear/workflows/<sha256 de cwd canónico>/<uuid>.jsonl`, con permisos solicitados 0700/0600 (dependen de SO y ACL; no cifrado).
- Esquema 1: cabecera, eventos secuenciales y fecha UTC; transiciones validadas, un escritor por UUID, máximo 1000 eventos y 256 KiB. Escritura de cada evento y fsync antes de avanzar; no garantiza durabilidad ante todos los fallos de filesystem o alimentación. No se reabre un journal para escribir. No hay lock global del workspace ni ejecución concurrente coordinada.
- Metadatos tipados, sin prompts, código, rutas de archivos, argumentos, respuestas del modelo, stdout/stderr ni credenciales: ruta elegida, digest y cantidad del contexto, digest/versión del plan y cantidad de criterios, respuestas humanas, contadores de ejecución, estado/código de tests y conteo de criterios respaldados. No guarda el contenido completo del plan ni evidencia detallada; esos artefactos requieren diseño de privacidad explícito. Las aprobaciones son eventos históricos, nunca permisos reutilizables.
- `executing` se escribe antes de crear/iniciar el executor; `verifying` antes de las pruebas. Las decisiones de herramientas y pruebas se registran antes de permitir la operación; no demuestran que la operación haya terminado. Un fallo de escritura detiene nuevos avances del flujo registrado; no deshace efectos anteriores.
- `your-gear workflows` muestra hasta 50 registros recientes del workspace; `your-gear workflow ID` recupera historial y estado sin autenticar, invocar modelos, ejecutar herramientas o modificar el journal. `complete: false` significa que falta cierre (podría seguir activo, estar interrumpido o haber fallado el registro). `effectsMayHaveOccurred` indica que se alcanzó una fase con posibles efectos; no prueba que hubo cambios. Un estado terminal indica cierre del workflow, no necesariamente éxito; solo accepted representa aceptación humana limitada.
- Registros corruptos, incompletos, rutas con ID inválido y transiciones inválidas se rechazan; no se reparan ni importan. La consulta no certifica autenticidad del registro ni protege contra un usuario/proceso con acceso a los archivos; no es auditoría inmutable, sandbox ni DLP. Retención/eliminación manual y controles avanzados quedan pendientes.
- Tests de recuperación sin cierre, aislamiento, esquema, secuencia, corrupción, privacidad y smoke sin proveedor. CI del PR #19 exitoso (run 45498413572).

## Incremento 3.D.2 — Recuperación guiada sin replay

Referencia: fase 7 y `src/task.ts` de Your Harness v0. Se adopta el gate de recuperación y la replanificación, pero no se hidratan permisos ni se reactiva la tarea anterior.

- `your-gear --recover ID [--context archivo] [--verify-test archivo] "trabajo pendiente"` exige TTY y registro sin cierre del workspace actual. El usuario confirma que el proceso anterior y sus descendientes terminaron, que inspeccionó el workspace y que la nueva solicitud describe solo el trabajo restante. Rechazo, registro inválido, terminal o de otro workspace no crean intento. Si se alcanzó una fase con efectos posibles, exige al menos un archivo de contexto explícito.
- `workflow-recovery.ts` calcula un digest del registro anterior y valida que no haya cambiado durante el gate. Se crea un journal nuevo con evento recovery (parentId y parentDigest), sin modificar el anterior. La clasificación y planificación son nuevas, con contexto actual y las mismas aprobaciones del flujo task. La solicitud agrega una indicación de no repetir efectos y pedir aclaración si falta evidencia. No importa prompt, plan, decisiones ni resultados anteriores.
- Revalidación del registro padre antes de iniciar executor, antes de nuevas operaciones aprobadas y durante gates de verificación. No hay lock global, prueba infalible de que el proceso anterior terminó ni exclusión de otros escritores. El control es conservador y no garantiza evitar todas las carreras o efectos duplicados: el usuario revisa las operaciones. No hay replay automático ni rollback.
- Se conserva la minimización de datos: no se persiste el texto del plan ni prompt ni evidencia completa. En recuperación manual el usuario debe suministrar nuevamente la información necesaria; desde 3.D.4 puede recuperarse un resumen del plan si hay checkpoint válido. la recuperación no es una continuación transparente de sesión ni reactivación de un estado terminal. Un nuevo intento inicia versión de plan 1 bajo un UUID nuevo. Se mantiene compatibilidad de lectura con registros previos.
- Tests de vínculo, aislamiento, rechazo, cancelación, modificación del padre y no importación de permisos; smoke sin TTY. CI del PR #20 exitoso (run 45501224735). [Guía de aceptación manual](../spikes/milestone-3-acceptance.md) incluye casos de clasificación, planificación, gates, pruebas, journal y recuperación. No se declara aceptado el workflow con modelo real.

## Incremento 3.D.3 — Memoria agéntica opcional

Decisión acordada: adelantar parte de Hito 4 para mejorar recuperación, sin acoplar los proyectos. [ADR-004](../adr/ADR-004-optional-agent-memory.md). Se revisaron contratos y handlers reales de YTK Go, incluidos owner de sesión, lifecycle, scope fijo y respuestas structuredContent. La implementación histórica de v0 cargaba un módulo TS ya superado; se reutiliza MCP stdio de Pi.

- Puerto MemoryProvider y adaptador con seis operaciones YTK (list/search/get/start/save/finish), límites, scope y validación de resultado. La sesión activa pertenece a la misma conexión. No se exponen herramientas nuevas a los modelos. En 3.D.3 las escrituras estaban desactivadas en CLI; 3.D.4 habilita checkpoints opt-in y revisión de memoria recuperada, no briefing general.
- Configuración del usuario en ~/.your-gear/memory.json por ruta canónica exacta del workspace; ejecutable y DB absolutos existentes, project explícito y area opcional. No autoinstalación, no se ejecuta configuración del repositorio. YTK requiere configuración local propia previa. Se exige autorización de inicio y TTY para consultar un proveedor configurado. El binario puede migrar la base y tiene permisos del usuario; no es sandbox.
- Comandos memory status/list/search/get no requieren autenticación LLM. Ausencia de configuración devuelve disabled en status; errores de consulta no afectan workflows normales. Conexión y llamadas con presupuesto temporal 10 s, cierre en finally. No se garantiza límite de memoria del protocolo antes de recibir una respuesta ni cierre de descendientes.
- Tests de configuración, aislamiento, sesión, modo sin escritura y servidor fixture MCP stdio; smoke del paquete. CI del PR #21 exitoso (run 45503506875). Interoperabilidad contra binario YTK real aún no validada. Este incremento no guardaba checkpoints ni activaba recall/save automático.

## Incremento 3.D.4 — Checkpoints y recuperación asistida (experimental)

- Opt-in explícito `--run-task --memory` (implica registro) o `--run-task --record --memory`. El gate posterior a la aprobación del plan muestra el resumen exacto y scope de YTK; autoriza la sesión y checkpoints posteriores sin gates por operación. Si se rechaza o falla YTK, continúa el flujo sin memoria. No se habilita memoria por defecto.
- Checkpoints antes de efectos (plan aprobado), al retornar el ejecutor y al finalizar verificación. Guardan objetivo, alcance, pasos, criterios, rutas seleccionadas y observaciones acotadas derivadas de estados/contadores, no prompt crudo, código, output ni autorizaciones. El plan puede contener texto sensible: revisar la vista previa. No se registra progreso granular dentro de una llamada larga al executor; una interrupción allí conserva el checkpoint anterior.
- Cada checkpoint usa subjectKey por UUID/fase y se verifica por lectura exacta antes de registrar entryId, digest y hash del scope en el journal. Lectura por referencia, no similitud; no se reintentan escrituras inciertas. No hay transacción común SQLite/JSONL: una caída entre guardado y registro puede dejar memoria huérfana. Protege las rutas estándar .ytk-memory y .ytk-memory.json; el binario y la base no deben estar en el alcance editable del executor. No es sandbox.
- `--recover` lista hasta diez candidatos recientes sin cierre, enriquece hasta cinco con objetivos validados si se autoriza acceso YTK. `--recover ID` sin prompt recupera el último checkpoint exacto, presenta objetivo/alcance y rutas actuales a confirmar, vuelve a leer archivos con política vigente, verifica digest del padre y utiliza el flujo 3.D.2. No recupera tests, permisos ni ejecución; todos los gates se repiten. Opcionalmente `--context` reemplaza rutas históricas y `--verify-test` elige pruebas nuevas. Un nuevo intento solo guarda checkpoints con `--memory` explícito.
- Si no hay checkpoint válido, falla la recuperación asistida con indicación de la alternativa manual. No se reactiva un workflow terminal. No hay exclusión global del workspace. El bootstrap de YTK abre sesión pero no incorpora briefing general al LLM; recall de conocimiento técnico entre tareas se difiere al Hito 4.
- Tests de checkpoints, scope, digest, lectura exacta, rechazo, degradación y recuperación; smoke sin TTY. `npm run smoke:ytk -- /ruta/ytk-memory` crea base descartable y verifica escritura/reconexión/lectura sin LLM. Smoke YTK real pendiente: validar antes de usar datos reales. CI del PR #22 exitoso (run 45504735165), incluidos typecheck, tests, build, pack, install y smoke en los tres SO.

## Próximo paso

3.E: evaluar OpenSpec opcional. El CI #22 ya está verificado; comenzar por compatibilidad y propuesta sin efectos automáticos. La aceptación real de YTK y workflows sigue pendiente; mantener experimental y no activar automáticamente. Hito 4: recall contextual general, aprendizaje durable y RAG separado. No declarar cerrado Hito 3 solo por CI.
