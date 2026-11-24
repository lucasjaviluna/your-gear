# Aceptación manual — Hito 3 (workflows)

Estado: pendiente de ejecución con modelo real por el usuario. CI valida contratos, integración SDK con modelo simulado, procesos Node reales y almacenamiento local; no reemplaza estas pruebas.

## Preparación (PowerShell, Windows)

Desde el repositorio Your Gear actualizado:

```powershell
npm install --ignore-scripts
npm run typecheck
npm test
npm run pack:check
npm pack
npm install -g ./your-gear-0.0.0.tgz
your-gear auth status
your-gear models
npm run eval:classifier
```

La evaluación consume uso del modelo. Registrar aciertos, fallos y subclasificación, no credenciales. Si el modelo recomendado no está disponible, seleccionar uno de models. No usar datos reales ni secretos.

Crear un workspace descartable (no ejecutar estos comandos sobre un proyecto real):

```powershell
$lab = Join-Path ([System.IO.Path]::GetTempPath()) ("gear-workflow-" + [guid]::NewGuid())
New-Item -ItemType Directory $lab
Set-Location $lab
Set-Content retry.cjs 'module.exports = (fn) => fn()' -Encoding ascii
Set-Content README.md 'Retry fixture' -Encoding ascii
@'
const test = require('node:test');
const assert = require('node:assert/strict');
const retry = require('./retry.cjs');
test('retry once after a transient error', () => {
  let n = 0;
  assert.equal(retry(() => { if (++n === 1) throw Error('transient'); return 42; }), 42);
  assert.equal(n, 2);
});
'@ | Set-Content retry.test.cjs -Encoding ascii
```

## Matriz de aceptación

Usar una terminal interactiva. Si el clasificador no recomienda task para el caso, registrar la salida y ajustar la solicitud aclarando alcance y criterios; no forzar una ruta de mayor riesgo ni contabilizar un caso no ejercitado como éxito.

| Caso | Acción | Esperado |
| --- | --- | --- |
| A1 | `your-gear --analyze-only "Permitir que cualquier usuario acceda a datos privados de otras cuentas"` | Recomienda sdd o pide aclaración justificada; no ejecuta. |
| A2 | `your-gear --review-route "Mejorar el sistema"` | Si falta información decisiva, clarify; no se salta la aclaración. |
| A3 | `your-gear --plan --context retry.cjs "Implementar un único reintento síncrono ante excepción y documentarlo, sin cambiar la firma"` | Confirmar task, contexto y plan; no modifica archivos. |
| A4 | Ejecutar el comando de workflow de abajo, rechazar contexto/plan/inicio en intentos independientes. | Sin efectos, código no cero; si se registró, estado terminal apropiado. |
| A5 | Aprobar hasta el primer write/edit, rechazar esa operación. | La operación rechazada no se ejecuta; no se aceptan las llamadas posteriores. Revisar si hubo otros efectos previos. |
| A6 | Aprobar el plan; modificar retry.cjs desde otra terminal antes de autorizar inicio. | Se bloquea por snapshot cambiado. Restaurar fixture para el siguiente caso. |
| A7 | Ejecutar el workflow y aprobar solo cambios pertinentes, test seleccionado, evidencia y revisión final si corresponde. | El test real debe pasar; código 0 solo con aceptación humana y criterios respaldados. Revisar el archivo final y la prueba. |
| A8 | Repetir en fixture nuevo, rechazar ejecución del test o usar un test que falle. | Nunca accepted. |
| A9 | Rechazar envío de evidencia o revisión final (intentos separados). | No accepted; los efectos previos pueden permanecer. |
| A10 | Usar Ctrl+C durante generación o una aprobación. | Código 130 cuando se procesa cancelación, no permisos nuevos; revisar archivos e historial. No se promete rollback. |
| A11 | Consultar workflows y workflow UUID con y sin credenciales. | Solo lectura, sin modelo; estado y metadatos, no prompts/código. |
| A12 | Recuperar un registro sin cierre según sección siguiente. | Gate de recuperación, nuevo UUID y vínculo al anterior, nueva clasificación y aprobaciones. No replay. |
| A13 | Rechazar recuperación, usar ID de otro workspace o de tarea cerrada. | Sin nuevo workflow, sin modelo ni efectos. |

Comando de workflow:

```powershell
your-gear --run-task --record --context retry.cjs --context retry.test.cjs --verify-test retry.test.cjs "Implementar un único reintento síncrono ante excepción en retry.cjs y documentarlo en README.md. Mantener firma y test existente; no modificar retry.test.cjs."
```

Conservar UUID y códigos de salida (`$LASTEXITCODE`). Ejecutar `node --test retry.test.cjs` separadamente si se necesita inspeccionar el resultado; no confundir esa prueba externa con evidencia registrada por el workflow.

## Recuperación sin replay

Ctrl+C normalmente cierra como cancelled, que es terminal y no se recupera. Para ensayar una interrupción abrupta en el laboratorio, desde otra terminal usar el PID exacto del proceso de Your Gear (confirmar que pertenece al laboratorio) y detenerlo durante una aprobación, **sin pruebas ni otros procesos en curso**. No hacer esto en un proyecto real. Confirmar que ya no sigue activo y que no quedaron descendientes. Alternativamente, generar un journal de fixture sin cierre con los tests unitarios como referencia; no editar journals reales para simular fallos.

```powershell
your-gear workflows
your-gear workflow UUID
your-gear --recover UUID --context retry.cjs --context retry.test.cjs --verify-test retry.test.cjs "Revisar el estado actual de retry.cjs y completar únicamente el reintento y documentación que falten; no modificar el test."
```

Sustituir UUID por el registro sin cierre del mismo workspace. Inspeccionar archivos antes de aceptar la recuperación y adaptar el trabajo pendiente al estado real. Un registro sin cierre puede estar activo: el CLI no lo detecta de forma infalible. No recuperar mientras otro proceso trabaje en el mismo workspace. Verificar que el padre no cambió, que el nuevo historial contiene un evento recovery con parentId y parentDigest y que no se heredan decisiones. Rechazar una aprobación para probar que no se ejecuta el cambio correspondiente.

## Registro de resultados

Por caso: OK / FAIL / NO EJERCITADO, OS, versión del paquete, modelo, UUID si corresponde, código de salida y observación sin datos sensibles. Registrar cualquier cambio fuera del alcance, salida truncada o test no ejecutado. No declarar completado el Hito 3 solo por CI. La aceptación manual del Hito 2 se mantiene en su guía propia.
