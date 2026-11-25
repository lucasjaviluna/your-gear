# ADR-005 — Your Gear como plataforma local de trabajo agéntico

**Estado:** aceptado como dirección arquitectónica por el usuario, 2026-11-24. Implementación incremental pendiente; no modifica contratos ni permisos actuales.

## Contexto

Your Gear ya dispone de un CLI independiente con Pi, clasificación semántica, planificación, ejecución, verificación, journal y recuperación asistida por memoria YTK opcional. La visión acordada amplía el objetivo: instalación por desarrollador, intake de prompts/requests, estrategias gestionadas por el harness, conectores activables/desactivables, resiliencia, telemetría y TUI amigable.

## Decisión

- Your Gear gobierna el ciclo completo de la tarea. Pi es el runtime elegido, no la identidad ni el contrato de producto. No sustituirlo sin evidencia concreta.
- Adoptar una arquitectura local modular, sin microservicios obligatorios, con un límite de aplicación reutilizable por CLI y futura TUI. Extraer coordinación a medida que aparezcan casos de uso; no crear un framework de capas vacías.
- Mantener rutas explícitas actuales y evolucionar hacia entrada unificada con selección semántica y confirmación humana según riesgo. OpenSpec es una estrategia opcional, no requisito global.
- Configuración de conectores explícita, segura e independiente de implementaciones internas. Conectores deshabilitados no deben arrancar; su ausencia no afecta tareas que no dependan de ellos. No degradar silenciosamente requisitos esenciales.
- Separar conversaciones Pi, estado/autoridad del journal, conocimiento de memoria y telemetría. La memoria no restaura permisos; la telemetría no determina aceptación ni sustituye el journal.
- Resiliencia basada en clasificación de errores y semántica de efectos: presupuesto de reintentos, timeout, cancelación, reconciliación y recuperación. Nunca repetir acciones de resultado incierto a ciegas, ni reintentar un rechazo humano.
- Observabilidad local configurable, instrumentación incremental y exportación opcional con consentimiento. Medir uso de modelos cuando exista evidencia, sin confundir suscripción con coste de API. No exportar contenido sensible por defecto.
- TUI es presentación; no contiene la lógica de ejecución ni gobierna permisos. Selección de librería, protocolo API, esquema final de config, SDK público, storage de telemetría y exportadores quedan abiertos hasta pruebas concretas.

## Alternativas descartadas

- Wrapper centrado exclusivamente en el proveedor/modelo: no cubre el ciclo de trabajo.
- Runtime propio completo o reemplazo de Pi inmediato: aumenta mantenimiento sin caso demostrado.
- Motor universal de workflows o plugins antes de casos reales: riesgo de sobreingeniería.
- Dependencias obligatorias de YTK, OpenSpec, RAG o infraestructura de observabilidad: reducen portabilidad y autonomía.
- Reintentos globales indiferenciados y recuperación por replay: duplicación de efectos, riesgo y consumo.
- TUI como dueña de las decisiones y estados: acopla la UX al core.

## Consecuencias y seguimiento

La [visión](../vision.md) y [arquitectura objetivo](../target-architecture.md) son documentos normativos de dirección; la [arquitectura vigente](../architecture.md) describe lo implementado. Se preservan Hitos 0–3, su evidencia y deuda de aceptación. El roadmap anterior de Hitos 4/5 se amplía y redistribuye en 4–10; memoria avanzada pasa al 7 y producción al 10. Reliability/telemetría se introducen incrementalmente sin esperar a sus hitos de consolidación.

Esta decisión no autoriza activar capacidades experimentales por defecto, cambiar auth, enviar telemetría fuera del equipo, omitir gates o dar por aprobadas pruebas pendientes. Los contratos concretos y criterios de aceptación se desarrollan en los hitos respectivos. 3.E sigue siendo el próximo incremento.
