# Aceptación manual — Hito 3 (workflows)

Estado al PR #22: pendiente de ejecución con modelo real y binario YTK real por el usuario. [CI #22](https://github.com/lucasjaviluna/your-gear/actions/runs/45504735165) pasó en Windows, Linux y macOS. CI valida contratos, integración SDK con modelo simulado, procesos Node reales, almacenamiento local y MCP fixture; no reemplaza estas pruebas.

## Preparación (PowerShell, Windows)

Desde el repositorio Your Gear actualizado:

```powershell
npm ci --ignore-scripts
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

## Memoria YTK y recuperación asistida (3.D.3–3.D.4)

Primero, desde el checkout de Your Gear, validar el binario aprobado de YTK sin LLM:

```powershell
$ytk = (Get-Command ytk-memory).Source
& $ytk --version
npm run smoke:ytk -- "$ytk"
```

El script crea una base descartable, inicia sesión, guarda un checkpoint, comprueba lectura exacta, cierra/reconecta y recupera el checkpoint por referencia del journal. No usa la base habitual. Esperado: mensaje YTK real OK y código 0. No está incluido en CI. Registrar versión exacta del binario y cualquier error.

Para probar el workflow, volver a un workspace descartable con el fixture retry.cjs de arriba. Inicializar YTK por separado siguiendo la [guía de instalación de YTK](https://github.com/lucasjaviluna/your-team-knowledge/blob/main/docs/agent-memory-installation.md); revisar dry-run antes de ejecutar setup, ya que puede modificar configuración de otro host (por ejemplo Codex o Pi). Your Gear no instala YTK ni crea el registro del host. Confirmar archivo .ytk-memory.json y base existente. No utilizar la memoria real del equipo.

Agregar una entrada a `~/.your-gear/memory.json` preservando sus otras entradas y realizando backup previo. La clave debe ser la ruta canónica exacta que devuelve Node, no una ruta relativa. Ejemplo de datos para armar la entrada (adaptar proyecto/área a la configuración de YTK y el ejecutable real):

```powershell
$root = node -e "console.log(require('node:fs').realpathSync(process.cwd()))"
$entry = @{
  provider = "ytk"
  command = $ytk
  project = "PROYECTO_DEL_LAB"
  database = (Join-Path $root ".ytk-memory/ytk-memory.sqlite")
  area = "smoke"
}
@{ workspaces = @{ $root = $entry } } | ConvertTo-Json -Depth 5
```

Copiar únicamente la entrada correspondiente al workspace en el objeto workspaces de la configuración del usuario. Usar UTF-8 sin BOM. Indicar un área explícita para un scope reproducible; no compartir la DB del proyecto real. No escribir el ejecutable o la DB en rutas editables por el executor (la ruta estándar .ytk-memory está protegida para tools de archivos).

```powershell
your-gear memory status
your-gear memory list
your-gear memory search "retry"
your-gear --run-task --memory --context retry.cjs --context retry.test.cjs --verify-test retry.test.cjs "Implementar un único reintento síncrono ante excepción y documentarlo en README.md, sin cambiar el test."
```

El status configurado requiere autorización de inicio y no usa LLM. La sesión de checkpoints requiere un único consentimiento de almacenamiento tras aprobar el plan. Revisar el resumen por datos sensibles; no persistir prompts crudos, código, credenciales o resultados de tools. El CLI puede seguir sin memoria si el proveedor falla o se rechaza el consentimiento.

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| Y1 | Ejecutar smoke:ytk con el binario real | Escritura, reconexión y lectura exacta exitosas; código 0 |
| Y2 | Sin entrada memory.json del laboratorio, ejecutar memory status y un workflow normal | disabled; workflow normal no necesita YTK |
| Y3 | Con configuración válida, memory status/list/search y get ID real del laboratorio | Consultas con alcance correcto, sin LLM; rechazo de inicio no lanza servidor |
| Y4 | Aprobar memoria del plan y luego ejecutar flujo completo con --memory | Journal contiene referencias memory-checkpoint de fases alcanzadas; objetivo y observaciones en YTK, sin permisos importables |
| Y5 | En otro intento rechazar almacenamiento de memoria tras aprobar plan | Sin checkpoints nuevos; gates normales siguen vigentes |
| Y6 | Interrumpir abruptamente un intento después de checkpoint plan, durante gate de inicio (sin tools/test en curso) | Journal sin cierre; no confundir con Ctrl+C terminal; confirmar que terminó el proceso |
| Y7 | En el workspace de Y6 ejecutar --recover y --recover ID sin prompt | Candidato con objetivo si checkpoint válido; nueva revisión, contexto actual y nuevo UUID, sin replay ni aprobación anterior |
| Y8 | Rechazar recuperación desde memoria, usar ID cerrado, o deshabilitar temporalmente entrada de laboratorio | No se inicia nuevo intento asistido; cuando no hay memoria válida se indica recuperación manual |
| Y9 | En un fixture aparte, cambiar el contenido de una memoria por interfaz soportada de YTK y recuperar | El digest o lifecycle no coincide; rechazo, nunca reutilizar registro alterado |

Para Y6–Y7 seguir las precauciones de interrupción de la sección anterior. No interrumpir procesos durante una prueba externa. Confirmar que el journal padre conserva su historial; elegir nuevamente tests si se necesita aceptación final. Ejemplo:

```powershell
your-gear --recover
your-gear --recover UUID --context retry.cjs --context retry.test.cjs --verify-test retry.test.cjs
```

Si se desea guardar los checkpoints del nuevo intento, incluir --memory inmediatamente después del UUID. Si la referencia no existe, no coincide o se perdió la base, usar la recuperación manual con solicitud explícita. Registrar si el checkpoint quedó huérfano; no repetir una escritura incierta ni editar directamente SQLite o journals reales. Al finalizar, retirar solo la entrada del laboratorio en memory.json (preservar las demás) y conservar/eliminar la DB temporal según necesidad; si setup alteró otro host, seguir la desinstalación de YTK para ese laboratorio.

## Diagnóstico OpenSpec (3.E.1)

Estado: pendiente de validación real. Usar un workspace descartable y un binario standalone de OpenSpec obtenido del [release v2.2.0](https://github.com/Fission-AI/OpenSpec/releases/tag/v2.2.0), verificando su procedencia y checksum según el release. No instalar ni inicializar automáticamente desde Gear.

```powershell
your-gear sdd status
your-gear sdd probe "C:\ruta\confiable\openspec.exe"
```

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| S1 | status en workspace sin openspec/ | root missing, cli not-probed, ready false; sin auth/modelo ni archivos nuevos |
| S2 | status en fixture con openspec/config.yaml y changes/add-retry/proposal.md | Marcadores y candidato presentes, ready false; no lee contenido ni ejecuta CLI |
| S3 | status en raíz con puntero a store o desde subdirectorio | No sigue store ni asciende a padres; no afirmar raíz efectiva |
| S4 | probe con ejecutable real; rechazar arranque | Código distinto de cero; no iniciar proceso |
| S5 | probe con ejecutable real; aprobar | Versión reportada por el ejecutable; compatibility not-validated |
| S6 | probe sin TTY, ruta relativa o binario inexistente | Rechazo; sin fallback a PATH o instalación |
| S7 | sdd apply o --run-task con recomendación sdd | Rechazo de operación no habilitada; sin cambios SDD |

El probe es un proceso autorizado, no sandbox. Registrar OS, versión exacta, salida y resultado, sin credenciales. No declarar interoperabilidad completa ni permiso de apply a partir del éxito de --version. Los escenarios posteriores de lectura JSON, propuesta y ejecución se añadirán en 3.E.2–3.E.4.

## Registro de resultados

Por caso: OK / FAIL / NO EJERCITADO, OS, versión del paquete, modelo, UUID si corresponde, código de salida y observación sin datos sensibles. Registrar cualquier cambio fuera del alcance, salida truncada o test no ejecutado. No declarar completado el Hito 3 solo por CI. La aceptación manual del Hito 2 se mantiene en su guía propia.
