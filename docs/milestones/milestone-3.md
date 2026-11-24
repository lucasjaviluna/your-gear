# Hito 3 — Workflows con humanos en el circuito

**Estado:** 3.A, 3.B, 3.C.1, 3.C.2 y 3.C.3.A integrados con CI exitoso; 3.C.3.B (verificación experimental y revisión final) propuesto. El usuario acordó diferir la aceptación manual del Hito 2; no se considera aprobada.

## Referencias y decisiones

Se revisaron los documentos de Your Harness v0 [fase 3](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/PHASE_3_ASSESSMENT.md), [fase 4](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/PHASE_4_TASKS.md) y [fase 16](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/PHASE_16_AGENT_ASSESSMENT.md). Describen recomendación de ruta, confirmación humana, clasificación asistida por modelo sin herramientas, fallback conservador y gates ante cambios de alcance. Son referencias de diseño, no evidencia de compatibilidad directa con Your Gear. Inspeccionar implementación y tests de v0 antes de reutilizar código.

## Alcance propuesto

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
| 3.D | Estado y trazabilidad de workflow, recuperación y aceptación | No reejecutar efectos por reanudar; distinguir verificación real de afirmaciones del modelo |
| 3.E | Evaluar integración SDD/OpenSpec opcional | Verificar necesidad y compatibilidad, diseñar gates y tests antes de activar |

El orden se revisará con evidencia. No introducir abstracciones públicas ni persistencia adicional sin una necesidad comprobada; evaluar entradas custom de Pi antes de decidir.

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
- `task-orchestrator.ts` controla de forma determinista la secuencia: verifica ruta, aprobación de plan y digest de entrada, vuelve a recopilar el snapshot, pide autorización separada para iniciar y vuelve a comprobar plan y contexto. El CLI comprueba también el snapshot inmediatamente antes de llamar al ejecutor. No acepta permisos importados ni persiste estado. La comprobación detecta cambios en el snapshot seleccionado, no en todo el repositorio.
- `executor-agent.ts`: sesión Pi efímera, system prompt propio, modelo configurable con `agents.executor` y `YOUR_GEAR_EXECUTOR_MODEL`. Solo read/write/edit; todas las llamadas requieren aprobación humana, incluso read (se envía al modelo). Reutiliza política de rutas y gate, revalida la decisión tras la espera. Una denegación bloquea llamadas posteriores; operaciones ya aprobadas o iniciadas pueden haber tenido efectos. No hay sandbox, rollback ni enforcement semántico del alcance; el prompt orienta al modelo y el usuario inspecciona las operaciones. No se ejecutan comandos ni se cargan MCP, skills o extensiones externas.
- La salida incluye reporte del modelo, número de llamadas bloqueadas y errores observados en eventos de herramientas. Estado final `awaiting-verification`, nunca completado/verificado. Un reporte textual no demuestra que se cumplan criterios; los errores y bloqueos se señalizan con código de salida distinto de cero. Cancelar o fallar no deshace archivos.
- Tests del orquestador (rechazo, ruta, plan/entrada alterados, contexto cambiado y cancelación), configuración y prueba con sesión Pi real y modelo simulado que intenta escribir un archivo temporal. CI del PR #17 exitoso (run 45363880799).
- Reevaluación de la deuda del Hito 2: la ruta experimental se limita a las herramientas de archivos ya ejercitadas en Windows durante Hitos 0/1 y a tests de efectos; no utiliza MCP ni shell. Probar únicamente en workspace descartable, con modelo real y revisión humana, antes de uso habitual. No se declaran aceptadas las pruebas diferidas.

## Incremento 3.C.3.B — Verifier Agent y revisión final

Se revisó [fase 8 de Your Harness v0](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/PHASE_8_VALIDATION.md): los resultados de validación deben distinguir éxito, fallo y pruebas no ejecutadas. No se traslada su infraestructura de empaquetado al workflow.

- `--run-task [--context archivo] [--verify-test archivo]... "solicitud"`: conserva gates previos. Se seleccionan explícitamente hasta tres archivos .test/.spec.js/.mjs/.cjs, sin globs ni comandos del modelo. Solo se intentan tras ejecución sin errores ni bloqueos. Cada prueba presenta el ejecutable, argumentos y contenido del archivo y requiere aprobación individual; se vuelve a leer el archivo antes de iniciar. No ejecuta otras pruebas tras un resultado distinto de exit-zero.
- `verification-evidence.ts`: ejecuta Node con `--test --test-reporter=tap` mediante execFile sin shell; timeout de 60 s, buffer 65536 bytes por flujo y extracto de 4000 caracteres de cada salida. Distingue exit-zero, failed, error, skipped y stale. Exit-zero solo afirma el código del proceso; no demuestra que haya tests relevantes ni cobertura. El código de prueba e imports pueden tener efectos arbitrarios, incluso fuera del workspace, acceder a red/entorno y crear descendientes. No hay sandbox ni garantía de detener descendientes; no usar código no confiable. Se eliminan NODE_OPTIONS, NODE_PATH, NODE_TEST_CONTEXT y NODE_V8_COVERAGE del entorno hijo; el resto se hereda.
- Se toma un snapshot posterior de los archivos de contexto seleccionados y metadatos conocidos. No es un diff completo ni un inventario de todos los archivos modificados. No garantiza que el código importado por las pruebas permanezca igual. Un fallo de lectura impide completar la verificación.
- `verification.ts`: evidencia identificada por ID, evaluación por criterio y esquema estricto. No acepta referencias inexistentes, índices repetidos o autorización inventada. El reporte del executor no cuenta como evidencia. Antes de enviar el snapshot posterior, extractos de tests y reporte al proveedor, se muestra el payload y se pide autorización. El Verifier Agent utiliza una sesión Pi independiente sin herramientas y modelo configurable mediante `agents.verifier` o `YOUR_GEAR_VERIFIER_MODEL`.
- La aceptación final es humana y limitada a la evidencia seleccionada; exige al menos un test ejecutado con exit-zero, sin truncamiento, sin errores/bloqueos del executor, todos los criterios supported y snapshot vigente. No se equipara accepted a certificación técnica de todo el repositorio. Sin pruebas, rechazo, fallos, evidencia insuficiente o cambio de snapshot no hay aceptación. El CLI conserva el reporte de ejecución y los metadatos de tests aunque falle el verificador; solo devuelve 0 si hay aceptación final. Ctrl+C devuelve 130. No hay rollback ni reintentos automáticos.
- Tests unitarios de contrato, referencias, gates y procesos reales de Node en workspace temporal, sin modelo real; smoke del paquete. CI pendiente. Sigue siendo experimental, con pruebas reales de usuario pendientes.

## Próximo paso

3.D: persistencia de estados y trazabilidad, recuperación de ejecuciones interrumpidas sin reproducir efectos, reanudación segura y evidencia de aceptación. No importar permisos ni reejecutar comandos automáticamente. Mantener pendiente la aceptación manual del Hito 2, la evaluación semántica real del clasificador y el smoke integral del workflow. 3.E: integración SDD opcional.
