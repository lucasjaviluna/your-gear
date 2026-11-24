# Spike — Viabilidad del SDK de Pi

**Estado:** spike histórico del Hito 0, ejecutado para el alcance inicial; resultados en [evidencia](pi-sdk-smoke.md) y [ADR-001](../decisions/ADR-001-runtime.md). Actualización al PR #22: reanudación directa validada en Windows (Hito 1); skills/MCP y workflows integrados con CI, aceptación real adicional pendiente. Consultar [roadmap](../roadmap.md).

## Preguntas de investigación
1. ¿Se puede incrustar el SDK y ejecutar un prompt con streaming?
2. ¿Se puede aplicar una política externa verificable a todas las herramientas, incluidas extensiones/MCP?
3. ¿Es fiable persistir/reanudar y cancelar sesiones?
4. ¿Cómo se comporta en Windows + PowerShell?
5. ¿Qué versión y namespace de paquete son realmente estables en npm?

## Experimento mínimo original (histórico)
1. Instalar Node y elegir versión fija del SDK después de comprobar su paquete (selección vigente: Node >=22.19.0, Pi 1.6.0).
2. Utilizar modelo local o API key de prueba explícitamente autorizada.
3. Crear sesión con cwd de un directorio temporal y pedir listar un archivo.
4. Escuchar eventos streaming; registrar salida, límites y errores.
5. Implementar interceptación de tools; probar read, write, shell aprobados/denegados.
6. Forzar cancelación, timeout, error de proveedor; validar cierre y resumption.
7. Ejecutar en Windows (PowerShell) y en un segundo SO para detectar divergencias.

## Ejemplo documental de API (verificar al ejecutar)
```ts
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();
try {
  await session.prompt("Describe el directorio actual sin modificar archivos");
  console.log(session.getLastAssistantText());
} finally {
  session.dispose();
}
```
> Este ejemplo es ilustrativo, **no** se ha ejecutado en Your Gear.

## Criterios del spike y evidencia posterior
- [x] Ejecución y streaming reales con credenciales autorizadas, reportados por el usuario en Windows.
- [ ] Política aplicada a **toda** vía de efectos: gates verificados para las herramientas habilitadas y fixtures; no garantía universal, no sandbox.
- [x] Deny de escritura reportado en Windows; las pruebas automatizadas cubren el gate simulado.
- [x] Reanudación y cancelación comprobadas para casos puntuales en Windows durante Hito 1; no garantizan detener descendientes ni revertir efectos.
- [x] Versión/package documentados y ejecución en Windows reportada; faltan detalles de versión del entorno manual.
- [x] Resultado resumido, riesgos y estado actualizado en ADR-001.

## Evidencia
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md
