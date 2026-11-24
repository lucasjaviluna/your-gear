# Hito 3 — Workflows con humanos en el circuito

**Estado:** 3.A y 3.B integrados con CI exitoso; 3.C.1 (planificación aislada) propuesto. El usuario acordó diferir la aceptación manual del Hito 2; no se considera aprobada.

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
- Tests unitarios e integración Pi con modelo simulado; smoke del paquete sin TTY. CI y uso real pendientes. No persiste estado ni implementa revisiones interactivas del plan aún.

## Próximo paso

3.C.2: integrar contexto de repositorio de solo lectura, acotado por políticas, y revisar el plan con evidencia antes de ejecutarlo. Diseñar orquestación que vincule solicitud, ruta y versión aprobada en memoria, sin confiar en JSON importado. 3.C.3: executor y verifier bajo políticas existentes, con pruebas de efectos reales y revisión humana; reevaluar antes la aceptación manual del Hito 2. Mantener pendiente la evaluación semántica real de 3.B.
