# Vision — Your Gear

**Estado:** visión vigente · **Origen:** 2026-11-22 · **Revisión:** 2026-11-24 (PR #22)

## Propósito
Construir un harness de agentes de IA, terminal-first, robusto, fácil de configurar y extensible. No es un fork de un proyecto previo ni un experimento dedicado a Pi: Your Gear tiene identidad y decisiones propias.

## Usuario y casos principales
- Desarrollador que quiere describir una tarea, inspeccionar un plan y ejecutar herramientas con aprobación.
- Integrador que necesita modelos, herramientas, skills y políticas configurables.
- Equipo que quiere un CLI distribuible por npm, reproducible y trazable.

## Principios
1. Núcleo pequeño, dependencias claras, evitar microservicios por defecto.
2. Primero una ejecución real de extremo a extremo; luego abstracciones.
3. Aprobar antes de ejecutar acciones de riesgo; mostrar qué se ejecuta y qué cambió.
4. Sesiones recuperables, errores explícitos, cancelación y logs útiles.
5. Adaptadores de modelos: soporte técnico no implica autorización comercial/contractual.
6. Las extensiones no deben saltarse las políticas de herramientas.
7. Documentar los ADR y mantener test verificables por hito.

## MVP funcional (Hito 1)
Usuario instala/ejecuta `your-gear`, configura un proveedor permitido, escribe un prompt, ve la salida progresiva, autoriza una acción sensible, recibe resultado y puede reanudar una sesión. Este alcance fue validado manualmente en Windows; CI automatizado de distribución cubre Windows, macOS y Linux. No equivale a inferencia real en los tres sistemas.

## Evolución acordada tras el MVP

Workflows optativos con clasificación semántica y agentes especializados, revisión humana, evidencia y recuperación sin replay. Memoria agéntica opcional mediante YTK para checkpoints recuperables, separada del journal y del contexto conversacional de Pi. SDD/OpenSpec es el próximo incremento, no una obligación para tareas simples. Recall general y RAG documental quedan para Hito 4. Consultar [arquitectura](architecture.md) y [roadmap](roadmap.md) para estado actual.

## No objetivos del MVP inicial (histórico)
- RAG empresarial, multiagentes, infraestructura cloud, interfaz web.
- Motor de workflow declarativo complejo, catálogo remoto de plugins.
- Soportar todos los proveedores o autenticar planes de suscripción por medios no autorizados.
- Reimplementar innecesariamente el loop de agente o el almacenamiento de sesiones.

## Riesgos a validar
- Garantizar que *todas* las herramientas pasan por un control de aprobación previo.
- Aislamiento de credenciales/configuración y manejo de cancelaciones/reintentos.
- Evolución de la API del SDK elegido y restricciones de autenticación de proveedores.
- Diferencias de shell, paths y terminal entre Windows y Unix.

## Criterio de diseño
Si una capacidad puede implementarse con las primitivas existentes de manera comprobable, se prefiere reutilizarla. Si una biblioteca impide garantías de seguridad, trazabilidad o extensibilidad esenciales, debe poder reemplazarse detrás de un límite pequeño.
