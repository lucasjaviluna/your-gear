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
| 3.A | Contrato de evaluación, clasificador determinista conservador y modo análisis sin efectos | Casos frontera, ambigüedad, riesgo; ninguna herramienta ni ejecución de tareas |
| 3.B | Clasificación asistida por modelo sin herramientas, respuesta validada y confirmación humana de ruta | Respuesta inválida o fallo no autoriza acciones; riesgo explícito no se degrada; cancelación bloquea |
| 3.C | Ruta task con plan, gate, ejecución y verificación | Rechazo/cancelación impide ejecución; cambios de alcance invalidan aprobación |
| 3.D | Estado y trazabilidad de workflow, recuperación y aceptación | No reejecutar efectos por reanudar; distinguir verificación real de afirmaciones del modelo |
| 3.E | Evaluar integración SDD/OpenSpec opcional | Verificar necesidad y compatibilidad, diseñar gates y tests antes de activar |

El orden se revisará con evidencia. No introducir abstracciones públicas ni persistencia adicional sin una necesidad comprobada; evaluar entradas custom de Pi antes de decidir.

## Fronteras

El clasificador recomienda, no autoriza. La confirmación del workflow no sustituye las aprobaciones de herramientas. La ejecución conserva las políticas y cancelación actuales. El contexto del repositorio y del prompt se trata como datos no confiables; no concede permisos. La ruta directa existente debe seguir funcionando sin activar workflows.

## Incremento 3.A — Clasificador determinista

Se revisaron también los archivos de referencia [src/assessment.ts](https://github.com/lucasjaviluna/your-harness-v0/blob/main/src/assessment.ts), [src/task.ts](https://github.com/lucasjaviluna/your-harness-v0/blob/main/src/task.ts) y [tests/assessment.test.ts](https://github.com/lucasjaviluna/your-harness-v0/blob/main/tests/assessment.test.ts). Se adopta la idea de prioridad por riesgo, no su estado de tareas ni sus gates persistentes.

- `src/assessment.ts`: contrato mínimo con ruta recomendada, fuente, confianza cualitativa, razones, áreas e incógnitas.
- `your-gear --analyze-only "tarea"`: JSON en stdout; no lee configuración, crea sesiones, carga SDK de Pi, solicita modelos ni ejecuta herramientas. No admite opciones de sesión/MCP/skills; usar `--` para texto literal.
- Reglas en español e inglés, normalización de acentos, riesgo explícito > ambigüedad > varios pasos > cambio local explícito > task conservador.
- No se interpreta la confianza como probabilidad calibrada. Reglas léxicas pueden producir falsos positivos y omitir riesgos implícitos; el resultado no concede permisos ni activa workflows.
- Tests unitarios y smoke del ejecutable instalado. CI del nuevo PR pendiente.

## Próximo paso

Validar el CI de 3.A. Resolver aceptación del Hito 2 antes de habilitar ejecución de workflows. Después implementar 3.B: evaluación asistida por el modelo con esquema validado, sin herramientas y confirmación humana.
