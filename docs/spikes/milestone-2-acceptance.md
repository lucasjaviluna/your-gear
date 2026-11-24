# Aceptación del Hito 2 — Extensiones y distribución

## Evidencia y alcance

No confundir CI con uso real mediante un proveedor. No se requiere publicar el paquete ni habilitar extensiones arbitrarias.

| Criterio | Evidencia | Estado |
| --- | --- | --- |
| Configuración usuario/proyecto y precedencia | Tests de configuración, CI #11 | Automatizado OK |
| Skills explícitas, rechazo de rutas externas | Tests del loader, prueba Windows reportada antes de #8 | OK para ese alcance |
| MCP explícito, permiso de arranque, gate por nombre | Tests de configuración y fixture stdio, CI #9–11 | Automatizado OK |
| Cancelación, cola de aprobaciones y bloqueo posterior | Tests de políticas, fixture stdio, CI #10–11 | Automatizado OK |
| Empaquetado, instalación y bin | CI #11 en Windows/Linux/macOS | Automatizado OK |
| MCP sin TTY antes de autenticar | Smoke del paquete, CI #12 | Automatizado OK |
| CLI instalado con modelo real, MCP y aprobaciones interactivas | Guía siguiente | Manual pendiente |
| Ctrl+C durante aprobación y continuidad de sesión | Guía siguiente | Manual pendiente |

CI comprobado: [#9](https://github.com/lucasjaviluna/your-gear/actions/runs/45310044405), [#10](https://github.com/lucasjaviluna/your-gear/actions/runs/45310838794), [#11](https://github.com/lucasjaviluna/your-gear/actions/runs/45311599196), [#12](https://github.com/lucasjaviluna/your-gear/actions/runs/45312487354).

## Preparación (Windows PowerShell)

Usar una terminal interactiva, Node >=22.19, Pi autenticado y un checkout limpio de Your Gear con el PR de aceptación integrado. No usar proyectos con datos sensibles.

Desde la raíz de Your Gear:

```powershell
npm ci --ignore-scripts
npm test
npm run typecheck
npm run pack:check
npm pack
$repo = (Get-Location).Path
$tgz = Join-Path $repo "your-gear-0.0.0.tgz"
$smoke = Join-Path ([IO.Path]::GetTempPath()) ("gear-smoke-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $smoke | Out-Null
Push-Location $smoke
npm init -y
npm install --ignore-scripts --no-audit --no-fund $tgz
$gear = Join-Path $smoke "node_modules/.bin/your-gear.cmd"
& $gear --version
& $gear --help
& $gear auth status
& $gear "Respondé hola y no uses herramientas"
```

Esperado: versión, ayuda, estado de autenticación y respuesta del proveedor. En caso de fallo, registrar el error redactado; no cambiar credenciales para sortear la prueba.

## MCP con un servidor descartable

El fixture se encuentra en `test/fixtures/mcp-server.cjs` del checkout. No forma parte del tarball. En la misma terminal y directorio temporal:

```powershell
$fixture = Join-Path $repo "test/fixtures/mcp-server.cjs"
$marker = Join-Path $smoke "events.txt"
$node = (Get-Command node).Source
@{ command = $node; args = @($fixture, $marker); tools = @("effect") } | ConvertTo-Json -Depth 5
```

Agregar la entrada resultante con nombre `gear_smoke` al objeto JSON de `~/.your-gear/mcp.json`. Si el archivo existe, conservar una copia y preservar las entradas existentes; no sobrescribir una entrada con el mismo nombre. Si no existe, crear un objeto con esa única entrada. Usar rutas absolutas. El servidor fixture solo escribe el marcador de prueba.

Ejecutar cada escenario por separado. Antes de cada escenario eliminar únicamente el marcador del directorio temporal si existe: `Remove-Item -LiteralPath $marker -ErrorAction SilentlyContinue`.

| Escenario | Acción | Resultado esperado |
| --- | --- | --- |
| M1 | `& $gear --mcp gear_smoke "Invocá effect una vez"`; rechazar arranque | Código no cero; marcador inexistente |
| M2 | Mismo comando; aprobar arranque, rechazar herramienta | Marcador con started y closed; sin tool:effect |
| M3 | Mismo comando; aprobar arranque y herramienta una vez | Marcador con started, tool:effect y closed |
| M4 | `& $gear --mcp gear_smoke "Intentá invocar extra"`; aprobar arranque | Sin tool:extra, aunque el modelo solicite esa herramienta |
| M5 | Comando M3; Ctrl+C durante pregunta de aprobación de herramienta | Cancelación y código 130; sin tool:effect y cierre del fixture |
| M6 | Mismo comando sin `--mcp`, pedir effect | Sin inicio del fixture ni marcador |

Inspeccionar el marcador con `Get-Content -LiteralPath $marker` cuando exista, y el código inmediatamente después de ejecutar el CLI con `$LASTEXITCODE`. Si el modelo no solicita la herramienta necesaria, el escenario es inconcluso, no aprobado. La prueba automatizada simula esas llamadas de manera determinista.

## Continuidad y regresión

```powershell
& $gear --persist "Recordá la palabra faro y respondé sin herramientas"
& $gear --continue "Qué palabra te pedí recordar? No uses herramientas"
```

Esperado: recuperar faro. Confirmar que la sesión de otro directorio no se utiliza automáticamente. No borrar sesiones ajenas. Al terminar, quitar solamente la entrada de prueba del registro MCP (o restaurar la copia si no hubo otros cambios), cerrar el directorio temporal con `Pop-Location` y eliminar únicamente `$smoke` cuando ya no se necesiten los resultados. El tarball del checkout puede conservarse o eliminarse explícitamente.

## Registro de resultados

Completar versión Node, versión Your Gear, sistema operativo, proveedor/modelo (sin secretos), commit, resultado de CLI instalado, M1–M6 y continuidad. Usar OK / FAIL / INCONCLUSO con observación breve. Los fallos de seguridad bloquean el cierre; un modelo que no llamó la herramienta no prueba el gate.

## Límites

MCP no es un sandbox. El proceso aprobado puede realizar efectos propios, heredar entorno o acceder fuera del workspace. No hay garantía de detener descendientes, interrumpir toda inicialización del SDK ni revertir efectos. Las sesiones y logs pueden contener información sensible. No se declara compatibilidad de modelos reales en Linux/macOS por el éxito del CI. Publicación, licencia y aislamiento de producción quedan fuera de este incremento. La aceptación manual Windows debe registrarse o diferirse mediante decisión explícita del usuario antes de declarar el Hito 2 cerrado.
