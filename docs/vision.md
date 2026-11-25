# Visión — Your Gear

**Estado:** visión de producto acordada con el usuario el 2026-11-24. Evoluciona la visión inicial del 2026-11-22 sin reemplazar la identidad del proyecto. Ver [roadmap](roadmap.md), [arquitectura vigente](architecture.md) y [arquitectura objetivo](target-architecture.md).

## Propósito

Your Gear es un harness agéntico extensible, configurable, resiliente y observable, diseñado para gestionar el ciclo completo de ejecución de tareas asistidas por IA, independientemente de los modelos, herramientas, sistemas de memoria y estrategias de trabajo utilizados.

Es una plataforma local de ejecución y orquestación de trabajo agéntico, terminal-first, no solo un cliente de LLM ni un wrapper de Pi. Pi sigue siendo el runtime elegido para el alcance validado; Your Gear conserva su identidad, autoridad de ejecución y experiencia de usuario. El objetivo de independencia es arquitectónico, no una afirmación de compatibilidad actual con todos los proveedores.

## Experiencia de producto deseada

Cada desarrollador instala un CLI distribuible, configura modelos y capacidades opcionales y trabaja en sus propios repositorios. El harness recibe prompts o requests, selecciona una estrategia semánticamente, recupera contexto permitido, coordina agentes, presenta decisiones humanas cuando corresponda, ejecuta y verifica resultados, registra evidencia y permite recuperar tareas interrumpidas.

El usuario no necesita coordinar manualmente todos los agentes, OpenSpec o las sesiones de memoria. Los comandos explícitos existentes siguen siendo útiles para diagnóstico, control, pruebas y automatización. La experiencia interactiva deberá mostrar progreso, modelos, consumo medido, aprobaciones, cambios, errores y opciones de recuperación de manera clara. Una TUI futura facilita ese trabajo sin asumir las responsabilidades del core.

Instalación npm publicada, setup asistido y sesión interactiva unificada son objetivos futuros. El paquete actual es privado y se prueba mediante tarball local; no se promete disponibilidad pública ni un comando setup implementado.

## Pilares

- **Request management:** entrada unificada, clasificación semántica, clarificación, selección de estrategia y seguimiento de solicitudes.
- **Workflow orchestration:** rutas direct/simple, task y SDD opcional, con gates, evidencia y políticas comunes; no un motor declarativo universal por anticipado.
- **Agent runtime:** reutilizar primitivas de Pi y sus proveedores autorizados; roles especializados y configuración de modelos, sin reimplementar loops innecesariamente.
- **Connectors:** capacidades de memoria agéntica, RAG, MCP, skills y SDD instalables/configurables cuando corresponda. Activación explícita, aislamiento de responsabilidades, diagnósticos y degradación controlada. Si son opcionales, su ausencia no bloquea el núcleo; si son requeridas para la tarea, bloquear o acordar alternativa.
- **Reliability:** errores clasificados, timeouts, reintentos acotados según naturaleza y resultado de la operación, cancelación, recuperación segura y reconciliación de efectos inciertos. No repetir efectos a ciegas ni importar aprobaciones anteriores.
- **Observability:** eventos, métricas, trazas y consumo de modelos con correlación por solicitud/workflow/agente/intento. Datos locales y minimizados por defecto; exportación externa explícita, opcional y bajo políticas de privacidad.
- **Developer experience:** instalación y configuración sencillas, CLI estable, TUI amigable y accesible, diagnósticos y recuperación guiada. Interfaces separadas de la lógica de aplicación.

## Principios no negociables

1. Núcleo pequeño y modular; un proceso local como arquitectura inicial. No microservicios, marketplace, DI/event bus universal ni contratos públicos antes de una necesidad comprobada.
2. Clasificación por LLM sin heurísticas léxicas como autoridad. Las decisiones de riesgo, permisos y gates se aplican por código confiable, fuera del modelo.
3. Reutilizar implementaciones existentes cuando satisfagan contratos y pruebas. Añadir límites pequeños ante una necesidad de aislamiento o sustitución, no por simetría.
4. Conectores independientes del código interno y almacenamiento de terceros. Pi conserva conversaciones, el journal conserva estados y decisiones, los proveedores de memoria conservan conocimiento y checkpoints.
5. Fail closed en operaciones sensibles; degradación solo cuando el resultado siga siendo válido sin la capacidad ausente. Reintentar únicamente con presupuesto y evidencia de seguridad.
6. No convertir memoria, telemetría, resultado LLM ni hashes en permisos. Sin secretos en almacenamiento/telemetría por diseño, con límites de detección explícitos.
7. Soporte técnico de un proveedor no implica autorización comercial; no fabricar accesos a suscripciones no autorizados ni facturación API implícita.
8. Desarrollar por incrementos pequeños con tests, aceptación real, documentación sincronizada y decisiones registradas. CI exitoso no equivale a aceptación ni certificación de producción.

## Alcance histórico y evolución

El MVP de Hito 1 validó en Windows un prompt directo, streaming, herramientas aprobadas y continuidad conversacional. Hito 2 añadió recursos y distribución, Hito 3 integra workflows task, verificación, journal y YTK optativo hasta 3.D.4. Las pruebas manuales de Hitos 2/3, evaluación semántica y smoke YTK real están pendientes. 3.E es el siguiente incremento: SDD/OpenSpec opcional.

Los objetivos de entrada unificada, conectores generales, resiliencia, memoria avanzada, observabilidad, TUI y producción se organizan en Hitos 4–10. No significa que estén implementados ni que las responsabilidades transversales deban esperar a su hito específico.

## No objetivos y límites

No construir un RAG empresarial dentro del núcleo, una plataforma cloud obligatoria, una base vectorial propia, un sistema multiagente distribuido ni una interfaz web antes de casos comprobados. No soportar todos los proveedores desde el inicio. No asumir sandbox, idempotencia total, rollback universal o compatibilidad multiplataforma real por el resultado de CI.

## Criterio de éxito

Un desarrollador puede instalar, configurar y utilizar Your Gear para completar tareas reales con esfuerzo operativo bajo, entender las decisiones y efectos, recuperar trabajo interrumpido, controlar integraciones y consumo, y mantener seguridad, estabilidad y trazabilidad verificables. El producto conserva utilidad sin conectores opcionales.
