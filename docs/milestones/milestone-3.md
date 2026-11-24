# Hito 3 — Workflows con humanos en el circuito

**Estado:** incremento 3.A propuesto, análisis aislado y sin efectos. La aceptación manual del Hito 2 sigue pendiente; no se habilitan workflows hasta resolverla.

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
- Tests de contrato, errores e integración con SDK y modelo simulado; los casos semánticos se deben evaluar también con un modelo real. CI pendiente.

## Próximo paso

Validar el CI de 3.A. Resolver aceptación del Hito 2 antes de habilitar ejecución de workflows. Después implementar 3.B: confirmación humana de ruta, configuración específica del clasificador y evaluación de calidad semántica.
