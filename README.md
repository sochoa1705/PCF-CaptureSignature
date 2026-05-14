# wacom-stu540-connector

Production-grade connector for the **Wacom STU-540** signature tablet,
designed to be embedded inside **Power Apps Canvas** apps (via iframe,
PCF, or Custom Connector). Built with **TypeScript**, **hexagonal
architecture** and **SOLID** principles so the transport
(WebHID / STU SDK / mock) and the SDK (Wacom Signature SDK for
JavaScript) are interchangeable behind ports.

> Status: reference implementation. The WebHID byte layout matches the
> public STU protocol documented in the Wacom STU SDK; please re-validate
> against the latest official SDK release before going to production —
> see the *Wacom documentation* section at the end of this file.

## Highlights

- **Hexagonal layout** — Domain / Application / Ports / Adapters /
  Infrastructure / Presentation, with strict dependency direction
  (Domain knows nothing about adapters).
- **WebHID-first** transport: no driver installs, runs on Edge/Chrome
  over HTTPS. Automatic fallback to a canvas/pointer adapter when WebHID
  is unavailable or when no tablet is plugged in.
- **Wacom Signature SDK adapter** that builds a SigObj (FSS / ISO 19794-7)
  and rasterises to PNG/JPEG/SVG. Gracefully degrades to a pure-canvas
  rasteriser for tests and design-time previews.
- **Use cases**: connect, capture, clear, cancel, disconnect, re-render.
- **Result pattern** instead of throwing exceptions across layer
  boundaries. Stable error `code`s map cleanly to Power Apps formulas.
- **Power Apps adapters**: postMessage bridge for iframe hosting and a
  PCF wrapper skeleton.
- **Vitest** test suite covering domain entities, use cases, and the
  Power Apps adapter (no Wacom hardware required).
- **Zero runtime dependencies** in the published bundle.

## Project layout

```
wacom-stu540-connector/
├── src/
│   ├── domain/           # Entities, value objects, errors, Result
│   ├── application/      # Use cases, DTOs, orchestrator
│   ├── ports/            # Hexagonal interfaces (no implementations)
│   ├── adapters/
│   │   ├── primary/      # PowerAppsAdapter (postMessage / PCF)
│   │   └── secondary/    # WebHID, SDK, fallback, logger, repository
│   ├── infrastructure/   # Config, DI container, factory
│   ├── presentation/     # WacomStu540Connector façade
│   └── index.ts          # Public API
├── tests/                # Vitest suites
├── examples/             # Power Apps iframe host + PCF wrapper + usage
└── README.md
```

## Quick start

### 1. Install

```bash
npm install
npm run build
```

The published bundle ships ESM, CJS, and `.d.ts` typings.

### 1.1 Install the private Wacom SDK package (real-device testing)

To use `@wacom/signature-sdk` from Wacom's private registry, copy
`.npmrc.example` to `.npmrc` and set your token in an environment
variable:

```bash
# PowerShell
$env:WACOM_NPM_AUTH_TOKEN = "YOUR_AUTH_TOKEN"
copy .npmrc.example .npmrc
npm install @wacom/signature-sdk
```

> The npm auth token grants package download access. It is different from
> the Wacom Signature SDK **license string** passed to
> `WacomStu540Connector.withLicense(...)`.

### 2. Load the Wacom Signature SDK (production)

In the host HTML page (or in your PCF bundle entry), load the official
Wacom Signature SDK for JavaScript **before** the connector. The SDK
attaches `window.WacomGSS`, which the `WacomSignatureSdkAdapter` consumes.

```html
<script src="/sdk/wacom-signature-sdk.min.js"></script>
<script type="module" src="/dist/index.js"></script>
```

If the SDK is missing the connector still runs in **fallback mode**:
SigObj output is replaced with a tagged JSON envelope (`version:
"fallback-1"`) and rasterisation is performed via the host canvas.
Useful for development; **do not ship to production** without the real
SDK because biometric verification relies on the official SigObj format.

### 3. Capture a signature

```ts
import { WacomStu540Connector } from 'wacom-stu540-connector';

const connector = WacomStu540Connector.withLicense(LICENSE, {
  canvasElement: document.getElementById('preview') as HTMLCanvasElement,
});

const result = await connector.captureSignature({
  signerName: 'Jane Doe',
  reason: 'Loan agreement',
  documentHash: '6a3f…',           // SHA-256 of the document
  outputFormat: 'png',
  outputWidthPx: 1200,
  outputHeightPx: 720,
});

if (result.ok) {
  document.querySelector('img')!.src = result.value.imageDataUrl;
  await fetch('/api/signatures', {
    method: 'POST',
    body: JSON.stringify(result.value),
  });
} else {
  console.error(result.error.code, result.error.message);
}
```

## Power Apps integration

> 📘 **Para integración completa en Canvas Apps via PCF + Azure Static Web Apps,
> consulta [`docs/CANVAS_INTEGRATION.md`](docs/CANVAS_INTEGRATION.md).**
> Esa guía cubre el control PCF `bbol.WacomCaptureHostPcf`, su deploy con
> GitHub Actions, configuración en Power Apps y patrones de uso (Patch a
> Dataverse, Image binding, comandos por Power Fx, etc.).

### Option A — iframe (recommended)

1. Host `examples/powerapps-iframe.html` on the same tenant origin
   (Azure Static Web Apps, App Service, …) over HTTPS. WebHID only
   works in secure contexts.
2. In Power Apps, add a **Web View** control and bind its `Source` to a
   URL that includes the license + signer metadata as query parameters.
3. On capture-complete, the iframe posts a message back to the parent:

   ```js
   window.parent.postMessage(
     { type: 'wacom-stu540:capture-complete', data: { /* CaptureSignatureResponse */ } },
     '*',
   );
   ```

4. Capture the message inside Power Apps via a thin PCF "host" control
   that forwards `window.message` events to Canvas. See
   `examples/powerapps-formula.md`.

### Option B — PCF control

Use `examples/PcfWrapper.ts` as the skeleton of a code component. The
control:

- exposes `license`, `signerName`, `reason`, `documentHash` as input
  properties,
- exposes `signatureBase64`, `signatureDataUrl`, `sigObjBase64`,
  `strokeCount`, `errorCode`, `errorMessage` as output properties,
- internally hosts a `<canvas>` for the live preview.

Build with:

```bash
pac pcf init --namespace Contoso --name WacomStu540 --template field
npm install
npm run build
pac pcf push --publisher-prefix con
```

### Option C — Custom Connector (server-relay)

If WebHID is not viable (Power Apps mobile player, locked-down kiosks),
expose the SigObj endpoint via a Custom Connector that POSTs to a
backend hosting a Windows service driving the tablet through the native
STU SDK. The shape of `CaptureSignatureResponse` is wire-compatible.

## License handling

**Never hardcode the Wacom license string.** Recommended pattern:

1. Store the license in Azure Key Vault (or any secret store).
2. Expose it through an authenticated endpoint (Azure Function, Power
   Automate flow) that checks the caller against Entra ID.
3. The iframe / PCF wrapper fetches the license at boot, then passes it
   to `WacomStu540Connector.withLicense(...)`.

Errors raised when the license is missing/invalid:

| Code | Meaning |
| --- | --- |
| `WACOM_LICENSE_MISSING` | License string was empty or whitespace |
| `WACOM_LICENSE_ERROR` | Wacom SDK rejected the license |
| `WACOM_LICENSE_EXPIRED` | Reserved for future expiry pre-checks |

## Error codes

All errors extend `DomainError` and expose a stable `code`:

| Code | Source | Typical cause |
| --- | --- | --- |
| `WEBHID_UNSUPPORTED` | Tablet | Browser without WebHID / non-secure context |
| `TABLET_NOT_FOUND` | Tablet | Device not plugged in / not authorised |
| `TABLET_PERMISSION_DENIED` | Tablet | User dismissed the WebHID picker |
| `TABLET_CONNECTION_ERROR` | Tablet | HID open/close failure |
| `TABLET_TIMEOUT` | Capture | Capture exceeded `captureTimeoutMs` |
| `SIGNATURE_EMPTY` | Capture | OK pressed without any ink |
| `SIGNATURE_CANCELLED` | Capture | User pressed Cancel |
| `SIGNATURE_CAPTURE_ERROR` | Capture | Unexpected error during capture |
| `SIGNATURE_RENDER_ERROR` | SDK | Rasterisation failed |
| `WACOM_LICENSE_MISSING` / `WACOM_LICENSE_ERROR` | SDK | License problems |

## Configuration reference

```ts
interface ConnectorConfig {
  license: { licenseString: string; issuedTo?: string; expiresAtIso?: string };
  ui: {
    title: string;
    reason: string;
    buttons: { clear: string; cancel: string; ok: string };
    backgroundImageBase64?: string;
    inkColor?: string;       // default '#0a205a'
    inkWidthPx?: number;     // default 2
  };
  captureTimeoutMs: number;   // default 120_000
  autoReconnect: boolean;     // default true
  maxReconnectAttempts: number; // default 3
  preferWebHid: boolean;      // default true
  canvasSelector?: string;
}
```

Use `buildConfig({ license, overrides })` from
`@infrastructure/config/WacomConfig` to merge sensible defaults with
caller-supplied overrides.

## Architecture

```
┌────────────────────────── Presentation ──────────────────────────┐
│  WacomStu540Connector  (façade)                                  │
└──┬───────────────────────────────────────────────────────────────┘
   │
┌──┴───── Primary Adapters ──────────────────┬─── Application ─────┐
│  PowerAppsAdapter (postMessage, PCF)       │  Orchestrator       │
└────────────────────────────────────────────┤  Use cases          │
                                             │  DTOs               │
┌──────────────────── Domain ────────────────┴─────────────────────┐
│  Signature, PenPoint, SignatureCaptureResult, TabletInfo, Result │
└──────────────────────────────────────────────────────────────────┘
                                ▲
                                │ ports
┌──────────────── Secondary Adapters ──────────────────────────────┐
│  WebHIDTabletAdapter        — talks to the physical STU-540      │
│  FallbackCanvasTabletAdapter — mouse/touch fallback              │
│  WacomSignatureSdkAdapter   — wraps window.WacomGSS              │
│  BrowserCanvasRendererAdapter — live preview                     │
│  ConsoleLoggerAdapter / InMemorySignatureRepository              │
└──────────────────────────────────────────────────────────────────┘
```

Dependency rule: arrows only point **inward** (toward Domain). Domain
imports nothing from outer layers; Application imports only Domain +
Ports; Adapters implement Ports and depend on Domain types; Infrastructure
wires everything together.

## Testing

```bash
npm test
```

Tests run under `jsdom` (no Wacom hardware required) and cover:

- Domain invariants (`Signature.test.ts`, `Result.test.ts`)
- `ConnectTabletUseCase` happy/error paths
- `CaptureSignatureUseCase` event-driven OK/Cancel/Empty cases
- `PowerAppsAdapter` request → response translation

To test against a real tablet, run `examples/usage-example.ts` inside a
browser context with the Signature SDK loaded and an STU-540 connected.

### Real STU-540 local test (iframe host)

1. Build and start the local host page:

   ```bash
   npm run build
   npm run serve:local
   ```

2. Open the iframe example in Edge/Chrome:

   ```text
   http://localhost:5500/examples/powerapps-iframe.html?license=YOUR_WACOM_LICENSE&who=Local%20Tester&reason=Real%20STU-540%20test
   ```

3. If needed, force an SDK path with `sdkSrc`:

   ```text
   http://localhost:5500/examples/powerapps-iframe.html?license=YOUR_WACOM_LICENSE&sdkSrc=/node_modules/@wacom/signature-sdk/legacy/signature-sdk.js
   ```

The page now shows SDK status:
- **Signature SDK loaded** = biometric pipeline enabled (`window.WacomGSS`).
- **fallback mode** = SDK not loaded (non-biometric dev mode only).

Note: the iframe demo does not paint OK/Clear/Cancel controls on the
tablet LCD. Those controls are provided by the host web page buttons.

## Prerequisites

- Browser: Chromium-based (Edge ≥ 89 / Chrome ≥ 89) running over HTTPS.
- Wacom STU-540 firmware: any recent revision (the public STU protocol
  is stable across firmware).
- A valid **Wacom Signature SDK for JavaScript** license, obtained from
  the Wacom developer portal.
- Power Apps Canvas environment (any plan that allows Web View or PCF).

## Known limitations

- The `renderUi` method writes only the inking-mode flag to the tablet.
  Pushing a full background image to the LCD is delegated to the Wacom
  Signature SDK (`WacomGSS.STU.Tablet`) — wire it through the SDK
  adapter if you need branded backgrounds.
- USB-bridge mode (older STU firmware) is not handled by the WebHID
  adapter. Use the official `stu-sdk-js` USB transport for those devices.
- WebHID is **not** available in the Power Apps Mobile player. For
  mobile signing, fall back to the canvas adapter and Pointer Events.
- The fallback rasteriser produces visually correct PNGs but the
  resulting "SigObj" is a JSON envelope (`fallback-1`) — not accepted by
  Wacom's server-side verification tools.

## Security & privacy

- Biometric data (`biometricPoints`) is sensitive personal data under
  GDPR. Encrypt at rest and transit, and retain only as long as legally
  required. Consider hashing the document and embedding the hash in
  `metadata.documentHash` so the signature is bound to a specific file.
- Licenses are secrets — distribute through Key Vault, not source code.
- Limit `attachPostMessageBridge` to your tenant's PowerApps origin
  (`/^https:\/\/.+\.powerapps\.com$/`) rather than `'*'` in production.

## Wacom official documentation

- Signature SDK overview:
  <https://developer-docs.wacom.com/docs/overview/sdks/sdk-for-signature/>
- Signature SDK for JavaScript (GitHub):
  <https://github.com/Wacom-Developer/signature-sdk-js>
- STU SDK download portal:
  <https://developer.wacom.com/en-us/developer-dashboard>
- WebHID API: <https://developer.mozilla.org/docs/Web/API/WebHID_API>

## License

MIT
