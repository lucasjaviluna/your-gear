# ADR-006 — OpenSpec como estrategia SDD opcional

**Estado:** decisión de dirección, 2026-11-25. Existe una inspección experimental local; el workflow SDD aún no existe ni está aceptado.

## Contexto

Cambios transversales pueden beneficiarse de requisitos, escenarios y diseño revisables antes de ejecutar. El flujo task produce planes y verifica evidencia, pero no ofrece por sí mismo un ciclo de especificaciones persistentes. La [evaluación de 3.E](../spikes/3e-openspec-evaluation.md) examinó OpenSpec 2.2.0 y realizó pruebas aisladas en Windows y Ubuntu/WSL. La mejora de calidad frente a task aún no se ha medido.

## Decisión

**Sí: adoptar OpenSpec como opción experimental para la futura ruta SDD**, sujeta a configuración y selección explícitas. Es una elección de proveedor para desarrollar y evaluar, no una afirmación de integración terminada, aceptación real ni dependencia obligatoria. Comenzar con inspección acotada de un change existente; evaluar generación, aplicación y archivo en incrementos posteriores.

No instalar ni inicializar OpenSpec automáticamente, ni cargar sus skills como autoridad. La ausencia o fallo no afecta flujos independientes. Si una solicitud requiere SDD, informar y detenerse o acordar una alternativa permitida; no degradar silenciosamente. Mantener el modo directo por defecto y las políticas y aprobaciones fuera del modelo y del proveedor. No cambiar el requisito Node de Your Gear para satisfacer un conector opcional.

OpenSpec aporta organización de artefactos y validación estructural. Su `isComplete`, la presencia de archivos y `validate` no acreditan implementación, cobertura ni aceptación humana. Las instrucciones y archivos externos son datos no confiables, y un ejecutable externo tiene permisos del usuario; no es sandbox. El primer corte debe verificar configuración y límites antes de iniciar, exigir autorización, limitar proceso y salida, verificar respuesta y raíz, y rechazar configuraciones o rutas no soportadas. Una verificación de raíz posterior no evita lecturas previas por el proceso.

## Alternativas y consecuencias

- SDD propio: evita dependencia externa pero duplicaría formatos y ciclo de vida antes de tener evidencia de necesidad.
- OpenSpec obligatorio o ejecución automática: descartado porque afecta portabilidad, autonomía y gates.
- Posponer toda decisión: conserva opciones, pero la evidencia disponible permite seleccionar un candidato sin comprometer la activación ni el alcance final.

El primer corte requiere pruebas deterministas de proceso, rechazo, timeout, cancelación, salida y rutas; smoke con la versión real fijada en plataformas objetivo; y evidencia comparativa de utilidad en una tarea real antes de declarar el workflow SDD aceptado. macOS, stores externos seguros, enlaces adversariales y aislamiento no están validados. La aceptación de 3.A–3.D.4 permanece pendiente. Reconsiderar proveedor o alcance si las pruebas o la comparación no justifican su costo.

## Evolución 3.E.4.A

Se propone un corte de planificación aislada con change existente. Se reutilizan el Planner sin herramientas y el esquema de plan, vinculando el origen y contexto al digest de la entrada. La revisión de artefactos y el consentimiento de envío son decisiones separadas; la revisión de plan no habilita ejecución. Se exige schema default confirmado por el contrato JSON v2.2.0 y los cuatro artefactos done, todas las delta specs del change y presupuesto de contexto. No se admiten skips ni selección parcial. Revisar la raíz y el árbol completo, aunque solo se divulgue contexto seleccionado; una mutación observada invalida el flujo. No confundir snapshot con sandbox, validación estructural con cobertura semántica, ni plan aprobado con autoridad de ejecución. Se consultaron [fase 6 de v0](https://github.com/lucasjaviluna/your-harness-v0/blob/main/docs/PHASE_6_OPENSPEC.md), [lab SDD](https://github.com/lucasjaviluna/agent-harness-lab/blob/main/src/sdd.ts) y [contrato v2.2.0](https://github.com/Fission-AI/OpenSpec/blob/v2.2.0/docs/agent-contract.md); se reutilizan patrones, no slash commands, clasificación léxica ni lógica de permisos de otros proyectos.
