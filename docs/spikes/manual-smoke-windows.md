# Smoke manual Windows — Your Gear (pendiente de ejecución)

## Objetivo
Comprobar que el prototipo puede invocar Pi SDK con un proveedor permitido, recibir streaming y exigir autorización antes de escribir un archivo. Esta prueba **no garantiza** sandboxing ni reemplaza los tests de integración automatizados.

**Requisitos:** Windows con PowerShell, Node.js >=22.19.0, npm y una API key válida de un proveedor compatible. Usar credenciales de API oficialmente autorizadas, **no tokens de suscripciones Claude.ai**. Ejecutar sobre un directorio temporal sin información sensible. **No copiar la clave ni trazas con secretos en issues o chats.**

## Preparación
Desde el repositorio:
```powershell
git pull origin main
node --version
npm install --ignore-scripts
npm run typecheck
npm test
$repo = (Get-Location).Path
```

Configurar un proveedor/modelo admitidos por Pi y una API key válida para API. El ejemplo usa OpenAI únicamente como referencia; elegir un modelo habilitado en tu cuenta.
```powershell
$env:YOUR_GEAR_PROVIDER = "openai"
$env:YOUR_GEAR_MODEL = "MODELO_DISPONIBLE"
$env:YOUR_GEAR_API_KEY = Read-Host "Introducí la API key (no la compartas)"
$workspace = Join-Path $env:TEMP "your-gear-smoke"
New-Item -ItemType Directory -Force -Path $workspace | Out-Null
Push-Location $workspace
```

**Nota:** `Read-Host` evita escribir el valor literal en el historial de comandos, pero muestra lo tecleado en la consola. Para mayor seguridad, usar un gestor de secretos y trasladar el valor al proceso sin imprimirlo. La ejecución mediante API puede tener coste.

## Pruebas con resultados esperados
1. **Streaming:** `node "$repo/src/cli.ts" "Respondé hola en una frase y no uses herramientas"`. Debe aparecer texto; ningún archivo debe modificarse. Registrar si el output es gradual.
2. **Deny:** `node "$repo/src/cli.ts" "Creá prueba-smoke.txt con el texto OK usando la herramienta write. No uses bash"`. Responder **N** al prompt. `Test-Path .\prueba-smoke.txt` debe ser `False`. Si no se presenta aprobación, tratar como fallo.
3. **Approve:** repetir el mismo comando y responder **s** solo después de revisar ruta y operación. `Test-Path .\prueba-smoke.txt` debe ser `True`. Revisar contenido con `Get-Content .\prueba-smoke.txt`.
4. **Cancelación:** pedir una tarea larga y probar Ctrl+C. Confirmar salida controlada sin operaciones posteriores. Los detalles de cancelación son exploratorios, no una prueba automatizada.
5. **Credenciales y errores:** probar con modelo inexistente después de resguardar la configuración y comprobar que el mensaje no revela la API key.

## Finalizar
```powershell
Pop-Location
Remove-Item Env:YOUR_GEAR_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:YOUR_GEAR_PROVIDER -ErrorAction SilentlyContinue
Remove-Item Env:YOUR_GEAR_MODEL -ErrorAction SilentlyContinue
```

**Reporte solicitado:** versión de Node, `npm test` / `typecheck`, streaming sí/no, deny sí/no, approve sí/no, Ctrl+C sí/no y texto de errores **sin secretos**. No subir el directorio temporal ni archivos de credenciales.

## Contexto de referencia
El repositorio [agent-harness-lab](https://github.com/lucasjaviluna/agent-harness-lab) contiene experiencias separadas con Pi CLI, SDK y RPC, tests de políticas, sesiones y manejo de Windows. Sirve como evidencia comparativa para ADR-001, no como código que deba copiarse automáticamente.
