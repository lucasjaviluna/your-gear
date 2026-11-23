# Smoke manual Windows — ChatGPT subscription con Pi

## Validaciones del Hito 0

**Resultado reportado por el usuario:** las comprobaciones de rutas externas y escritura sin TTY pasaron en Windows. La versión exacta de Node, el modelo y el detalle individual de cada caso no fueron registrados. Las pruebas automatizadas locales del gate y del proceso sin TTY también pasaron; no son una prueba integral del SDK.

Ejecutar con el checkout actual y la sesión ChatGPT de Pi activa. Las dos pruebas automatizadas de `test/validation.test.ts` verifican el gate y la aprobación con pipes, pero no sustituyen este recorrido con el SDK y el modelo real.

En PowerShell, desde el repositorio:

```powershell
$gearRepo = (Get-Location).Path
$gearSmokeRoot = Join-Path $env:TEMP ("your-gear-boundary-" + [guid]::NewGuid().ToString())
$gearWorkspace = Join-Path $gearSmokeRoot "workspace"
New-Item -ItemType Directory -Path $gearWorkspace -Force | Out-Null
$gearOutside = Join-Path $gearSmokeRoot "outside.txt"
Set-Content -LiteralPath $gearOutside -Value "original"
Push-Location $gearWorkspace
```

1. Para cada herramienta `read`, `write` y `edit`, pedir explícitamente que use la ruta absoluta `$gearOutside`, y repetir con `../outside.txt`. Por ejemplo:

   ```powershell
   node "$gearRepo/src/cli.ts" "Usá solo la herramienta read para leer el archivo $gearOutside. No uses bash."
   node "$gearRepo/src/cli.ts" "Usá solo la herramienta write para reemplazar ../outside.txt con CAMBIADO. No uses bash."
   node "$gearRepo/src/cli.ts" "Usá solo la herramienta edit para cambiar original por CAMBIADO en ../outside.txt. No uses bash."
   ```

   En cada uno de los seis casos debe aparecer `herramienta <nombre> bloqueada` y `Get-Content -LiteralPath $gearOutside` debe seguir mostrando `original`. Si el modelo no llama a la herramienta, el caso queda pendiente: no alcanza con su respuesta textual.

2. Probar escritura con stdin y stdout sin TTY:

   ```powershell
   "s" | node "$gearRepo/src/cli.ts" "Usá solo la herramienta write para crear no-tty.txt con el texto CAMBIADO. No uses bash." | Out-Null
   Test-Path -LiteralPath (Join-Path $gearWorkspace "no-tty.txt")
   ```

   Debe aparecer en stderr `herramienta write bloqueada` y `Test-Path` debe devolver `False`. Si no aparece el bloqueo, comprobar si hubo llamada a `write` antes de registrar el resultado; no considerar el caso aprobado solo porque no exista el archivo.

Al terminar, ejecutar `Pop-Location` y registrar por caso el resultado, modelo y versión de Node, sin copiar credenciales ni el contenido de archivos privados. El directorio temporal queda disponible para inspección.

**Estado:** el usuario reportó exitosas las pruebas manuales de lectura, escritura rechazada y aprobada, edición, shell, streaming, cancelación y errores del modelo. No realizar sobre un proyecto real o con secretos.

## Objetivo

Validar que Your Gear reutiliza el **login autorizado de ChatGPT en Pi** sin API key, que el streaming responde y que bloquea o aprueba operaciones sensibles antes de sus efectos. **No** es una certificación de aislamiento: el prototipo no es sandbox.

## Preparación en Windows PowerShell

Con Node.js >=22.19.0 instalado, ubicarse en la carpeta del repositorio:

```powershell
npm install --ignore-scripts
npm run typecheck
npm test
$repo = (Get-Location).Path
```

No es necesaria una API key. Ejecutar Pi y en su interfaz abrir `/login` → **OpenAI** → **Sign in with ChatGPT**. Completar el consentimiento en el navegador. Si la cuenta estaba autenticada en `openai-codex`, esta prueba requiere conectarla también al proveedor `openai`.

```powershell
Remove-Item Env:YOUR_GEAR_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:YOUR_GEAR_MODEL -ErrorAction SilentlyContinue
Remove-Item Env:YOUR_GEAR_AUTH_MODE -ErrorAction SilentlyContinue
Remove-Item Env:YOUR_GEAR_PROVIDER -ErrorAction SilentlyContinue
node src/cli.ts auth status
node src/cli.ts models
```

El status debe indicar **ChatGPT conectado** y `models` debe listar IDs de modelos disponibles. Si no, verificar que Pi instaló/actualizó la sesión OAuth bajo `openai` y que el plan/consentimiento son elegibles.

Crear un workspace descartable:

```powershell
$workspace = Join-Path $env:TEMP "your-gear-smoke"
New-Item -ItemType Directory -Force -Path $workspace | Out-Null
Push-Location $workspace
```

## Pruebas

1. **Streaming:** `node "$repo/src/cli.ts" "Respondé hola en una frase y no uses herramientas"`. Verificar que aparece respuesta y el modelo elegido en stderr.
2. **Deny:** `node "$repo/src/cli.ts" "Creá prueba-smoke.txt con OK utilizando write; no uses bash"`. Responder **N**. `Test-Path .\prueba-smoke.txt` debe ser `False`.
3. **Approve:** repetir el prompt; responder **s** después de revisar la ruta. `Test-Path .\prueba-smoke.txt` debe ser `True`.
4. **Cancelación:** pedir respuesta larga y presionar `Ctrl+C`, comprobando que la ejecución termine sin operaciones posteriores.
5. **Selección:** opcionalmente definir `$env:YOUR_GEAR_MODEL = "ID_DE_LA_LISTA"` y verificar que se utiliza ese modelo.
6. **Seguridad:** definir `$env:YOUR_GEAR_PROVIDER = "anthropic"` en modo de suscripción y confirmar que Your Gear lo rechaza. Luego limpiar la variable.

## Finalizar

```powershell
Pop-Location
Remove-Item Env:YOUR_GEAR_MODEL -ErrorAction SilentlyContinue
Remove-Item Env:YOUR_GEAR_PROVIDER -ErrorAction SilentlyContinue
```

Compartir **solo**: versión Node, resultados de typecheck/test, resultado de `auth status` sin tokens, modelo elegido, streaming sí/no, deny sí/no, approve sí/no, Ctrl+C sí/no, y errores redactados. No enviar `auth.json`, capturas del código OAuth, URLs de callback, cookies ni tokens.

## Limitaciones

El gate de herramientas es experimental, no es sandbox OS; las rutas tienen riesgo TOCTOU y la lectura de archivos sensibles puede no detectarse siempre. Una autorización de shell puede producir efectos fuera del workspace. La aceptación de ADR-001 está limitada al alcance validado.

Referencia: https://github.com/lucasjaviluna/agent-harness-lab

## Si solo aparece `Your Gear: openai/chat-latest (pi-subscription)`

En la primera versión el CLI únicamente imprimía los eventos `text_delta` y podía salir silenciosamente si el proveedor devolvía un mensaje de error o la respuesta final no llegaba por streaming.

Desde la corrección del PR #2, se muestran los errores `stopReason=error` de Pi y se recupera el contenido final cuando falta el streaming. Para probarla:

```powershell
# Desde el repo Your Gear
npm run typecheck
npm test
node src/cli.ts auth status
node src/cli.ts models

# Ejecutar desde un workspace temporal, con $repo apuntando al checkout:
Push-Location $workspace
node "$repo/src/cli.ts" "Respondé hola y no uses herramientas"
Pop-Location
```

Si el CLI sigue mostrando errores sobre el modelo `chat-latest`, copiá un ID exacto de `models` y ejecutá:

```powershell
$env:YOUR_GEAR_MODEL = "ID_REAL_DE_LA_LISTA"
Push-Location $workspace
node "$repo/src/cli.ts" "Respondé hola y no uses herramientas"
Pop-Location
Remove-Item Env:YOUR_GEAR_MODEL -ErrorAction SilentlyContinue
```

El mensaje de error (sin credenciales ni URLs OAuth) y el modelo elegido permiten distinguir si el problema está en permisos, cuotas, un modelo incompatible o el request. `auth status` confirma que Pi detecta una suscripción, **no** que la inferencia esté autorizada ni que el endpoint funcione.
