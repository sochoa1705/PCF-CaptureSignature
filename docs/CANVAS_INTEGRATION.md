# Integración en Power Apps Canvas

Esta guía explica cómo desplegar el conector Wacom STU-540 dentro de una Canvas App
mediante un control PCF que embebe la página web de captura hosteada en
Azure Static Web Apps.

## Arquitectura

```
┌──────────────────────────────────────┐
│     Canvas App (Power Apps)          │
│  ┌────────────────────────────────┐  │
│  │  PCF: bbol.WacomCaptureHostPcf │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │   <iframe allow="hid">   │──┼──┼─► https://<tu-swa>/capture.html
│  │  │   capture.html (SWA)     │  │  │   ├─ index.js  (connector)
│  │  └──────────────────────────┘  │  │   ├─ signature-sdk.js + .wasm
│  │   postMessage ↕ outputs        │  │   └─ STU-540 ⇄ WebHID
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

**Por qué este diseño:** Canvas Apps embebe los PCF en un iframe de
`apps.powerapps.com` que **no incluye** `allow="hid"`. La única forma de usar
WebHID desde Canvas es a través de un iframe externo cuyo origen
(Azure SWA en nuestro caso) declare `Permissions-Policy: hid=*`.

---

## Requisitos previos

| Herramienta | Para qué |
|---|---|
| Azure Subscription (Free tier sirve) | Hostear `web/` en Static Web Apps |
| GitHub repo | Workflow de deploy automático |
| Power Platform CLI (`pac`) ≥ 1.27 | Construir y publicar el PCF |
| Node.js 20+ | Build del connector |
| MSBuild + .NET Framework 4.6.2 (o Visual Studio 2022 Build Tools) | Empaquetar la solution `.zip` |
| Wacom npm token (`WACOM_NPM_AUTH_TOKEN`) | Descargar `@wacom/signature-sdk` |
| (Opcional) Wacom runtime license | Modo biométrico real |

---

## Paso 1 — Desplegar la página de captura en Azure SWA

### 1.1 Crear el recurso

1. Portal de Azure → **Create a resource → Static Web App**.
2. Plan: **Free**.
3. Region: la más cercana a los usuarios.
4. Source: **GitHub** → conecta tu fork/repo.
5. Build presets: **Custom**.
   - App location: `web`
   - Api location: *(vacío)*
   - Output location: *(vacío)*
6. **Create**. Azure genera automáticamente:
   - Un workflow en `.github/workflows/azure-static-web-apps-<id>.yml`
   - Un secret `AZURE_STATIC_WEB_APPS_API_TOKEN` en el repo

> ⚠ Renombra/borra el workflow autogenerado y deja únicamente el
> `.github/workflows/azure-static-web-apps.yml` que incluye este repo
> (que ya hace `npm run build:web` antes de desplegar).

### 1.2 Configurar secrets del repo

En GitHub → **Settings → Secrets and variables → Actions** añade:

| Secret | Valor |
|---|---|
| `WACOM_NPM_AUTH_TOKEN` | Tu token de `npm.wacom.com` |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | (lo creó Azure automáticamente) |

### 1.3 Push y verificar

```powershell
git add .
git commit -m "Setup Wacom capture web bundle"
git push
```

Al terminar el workflow, tu URL será algo como:
`https://<random-name>.azurestaticapps.net/capture.html`

**Probarla en un navegador:** debe cargar la página de captura. Si abres
DevTools verás `[wacom-stu540] capture-started` cuando inicia.

---

## Paso 2 — Construir y publicar el PCF

### 2.1 Construir localmente

```powershell
cd pcf\WacomCaptureHostPcf
npm install
npm run build
```

### 2.2 Empaquetar la solution

Necesitas **MSBuild** (viene con Visual Studio 2022 Build Tools).
Abre **Developer Command Prompt for VS 2022** y ejecuta:

```bat
cd pcf\solution
msbuild /t:build /p:configuration=Release
```

Esto produce `pcf\solution\bin\Release\solution.zip`.

### 2.3 Importar en Power Apps

1. https://make.powerapps.com → **Solutions → Import solution**.
2. Selecciona `solution.zip`.
3. Importar.

El control quedará disponible en el editor de Canvas como
**Insert → Get more components → Code → Wacom STU-540 Capture**.

> 💡 Para que un control PCF aparezca en Canvas Apps el environment debe tener
> habilitado **"Power Apps component framework for canvas apps"** en
> *Settings → Product → Features*.

---

## Paso 3 — Usar el control en una Canvas App

### 3.1 Insertar y configurar

1. Abre tu Canvas App en edición.
2. **Insert → Code components → Wacom STU-540 Capture**.
3. Configura las propiedades en el panel de la derecha:

| Propiedad | Ejemplo | Notas |
|---|---|---|
| `IframeUrl` | `"https://<tu-swa>.azurestaticapps.net/capture.html"` | **Obligatorio** |
| `SignerName` | `User().FullName` | |
| `Reason` | `"Aceptación de términos"` | |
| `Location` | `"Sucursal Guayaquil"` | |
| `License` | `""` | Pegar la licencia runtime de Wacom si la tienes |
| `AutoStart` | `true` | Inicia captura al cargar |
| `Command` | `""` | Bound: setear con `UpdateContext` |

### 3.2 Outputs disponibles (lectura)

Asume que llamaste al control `ctlWacom`:

| Expresión Power Fx | Tipo | Uso |
|---|---|---|
| `ctlWacom.Status` | Text | `"Loading"`, `"Ready"`, `"Capturing"`, `"Captured"`, `"Cancelled"`, `"Error"` |
| `ctlWacom.ImageDataUrl` | Text | Pegar directo en `Image.Image` |
| `ctlWacom.ImageBase64` | Text | Base64 puro del PNG |
| `ctlWacom.SigObjBase64` | Text | Blob biométrico (o JSON envelope en fallback) |
| `ctlWacom.StrokeCount` | Number | Cantidad de trazos |
| `ctlWacom.CapturedAtUtc` | DateTime | Timestamp UTC de la captura |
| `ctlWacom.LastError` | Text | Mensaje de error de la última captura fallida |

### 3.3 Patrones de uso

**Mostrar la firma capturada en un control Image:**

```powerfx
// En la propiedad Image de un control Image
imgFirma.Image = ctlWacom.ImageDataUrl
```

**Reaccionar a una captura completada (en `OnChange`):**

```powerfx
// ctlWacom.OnChange
If(
    ctlWacom.Status = "Captured",
    Set(varFirmaCapturada, true);
    Notify("Firma capturada (" & ctlWacom.StrokeCount & " trazos)", NotificationType.Success)
)
```

**Disparar comandos desde botones de la app (sin tocar la UI del iframe):**

```powerfx
// Botón "Iniciar nueva firma"
UpdateContext({ wacomCmd: "start" })
// Bind ctlWacom.Command = wacomCmd
```

Comandos válidos: `"start"`, `"cancel"`, `"clear"`, `"submit"`.
El PCF resetea automáticamente `Command` a `""` después de despachar.

**Guardar la firma en Dataverse:**

```powerfx
// Botón "Guardar"
Patch(
    Firmas,
    Defaults(Firmas),
    {
        bbol_signername:   ctlWacom.SignerName,
        bbol_capturedat:   ctlWacom.CapturedAtUtc,
        bbol_strokecount:  ctlWacom.StrokeCount,
        bbol_imagebase64:  ctlWacom.ImageBase64,
        bbol_sigobj:       ctlWacom.SigObjBase64
    }
)
```

---

## Paso 4 — Cosas a saber

### Permisos de WebHID

La **primera vez** que un usuario use la app desde una PC, el navegador pedirá
autorización para ver el dispositivo HID. Esto ocurre dentro del iframe de SWA;
el usuario debe aceptar. Después, el navegador recuerda el permiso.

### Origen permitido

El header `Permissions-Policy` en `web/staticwebapp.config.json` ya autoriza
`apps.powerapps.com`, `make.powerapps.com` y `*.dynamics.com`. Si tu tenant
usa otro dominio (ej. GCC, GCC High), agrégalo ahí y redespliega.

### Modo biométrico vs fallback

- **Sin licencia (`License = ""`)**: el control captura puntos y entrega
  un PNG + sigObj JSON envelope. No hay datos firmados criptográficamente.
- **Con licencia runtime de Wacom**: se construye un SigObj real (FSS, base64).
  Solicita la licencia en https://developer.wacom.com → Developer Dashboard,
  package id `{6405296E-172C-4BC9-BD55-082537027CB6}`.

### Limitaciones

- WebHID solo funciona en navegadores Chromium (Edge, Chrome). Firefox/Safari
  no soportan WebHID.
- Power Apps Mobile (iOS/Android) **no funcionará** porque el navegador embebido
  no expone WebHID. Usar siempre desde browser desktop.
- Si el iframe se carga antes de que el usuario haya autorizado el dispositivo,
  el primer `start` mostrará el diálogo de selección.

### Diagnóstico en producción

El iframe ya incluye un panel `⚙ Diagnóstico` colapsable con los eventos HID
en tiempo real. Para troubleshooting remoto, instruye al usuario a:
1. Hacer clic derecho en el control PCF → **Inspect frame**.
2. Console tab → buscar `[wacom-stu540]`.

---

## Apéndice — Estructura del repositorio

```
wacom-stu540-connector/
├── src/                          # Connector (TypeScript, hexagonal)
├── examples/                     # Página de prueba local (no se despliega)
├── dist/                         # Build de tsup
├── web/                          # ★ Bundle desplegado a Azure SWA
│   ├── capture.html
│   ├── index.js                  # (generado por scripts/build-web.mjs)
│   ├── signature-sdk.{js,wasm}   # (generado)
│   ├── stu-sdk.min.js            # (generado)
│   └── staticwebapp.config.json
├── pcf/
│   ├── WacomCaptureHostPcf/      # ★ El PCF
│   │   ├── ControlManifest.Input.xml
│   │   ├── index.ts
│   │   └── css/WacomCaptureHostPcf.css
│   └── solution/                 # ★ Wrapper Dataverse solution
│       └── solution.cdsproj
├── scripts/
│   └── build-web.mjs             # Copia dist + SDK al folder web/
└── .github/workflows/
    └── azure-static-web-apps.yml # Deploy automático
```
