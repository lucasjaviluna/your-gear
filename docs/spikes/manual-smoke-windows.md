# Smoke manual Windows — ChatGPT subscription con Pi

**Estado:** pendiente de ejecución por el usuario. **No realizar sobre un proyecto real o con secretos.**

## Objetivo

Validar que Your Gear reutiliza el **login autorizado de ChatGPT en Pi** sin API key, que el streaming responde y que bloquea o aprueba operaciones sensibles antes de sus efectos. **No** es una certificación de aislamiento: el prototipo no es sandbox.

## Preparación en Windows PowerShell

Con Node.js >=22.19.0 instalado, ubicarse en la carpeta del repositorio **de la rama del PR #2, hasta que se fusione**:

```powershell
git fetch origin
git checkout feat/pi-chatgpt-subscription-auth
git pull origin feat/pi-chatgpt-subscription-auth
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

El gate de herramientas es experimental, no es sandbox OS; las rutas tienen riesgo TOCTOU y la lectura de archivos sensibles puede no detectarse siempre. Una autorización de shell puede producir efectos fuera del workspace. El Hito 0 no estará cerrado hasta validar la integración real y ADR-001.

Referencia: https://github.com/lucasjaviluna/agent-harness-lab
