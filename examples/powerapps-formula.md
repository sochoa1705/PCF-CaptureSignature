# Power Apps Canvas — calling the connector

When the connector is hosted in an iframe (or a PCF control configured to
relay postMessage events) the Canvas app drives it from formulas like the
ones below. Adapt the variable names to your screen.

## 1. Open the screen and inject the license

```powerapps
OnVisible:
Set(
  gblWacomIframeUrl,
  $"https://signatures.contoso.com/wacom-stu540/?license={EncodeUrl(MyLicenseEnvVar)}&who={EncodeUrl(User().FullName)}&reason={EncodeUrl("Loan agreement")}"
);
```

Bind `gblWacomIframeUrl` to a Power Apps **Web View** control or to an
iframe inside an HTML Text component.

## 2. Listen for the capture-complete event

The connector posts `{ type: 'wacom-stu540:capture-complete', data: {...} }`
to the parent window. Wrap the Web View in a PCF host that bridges
window events into Power Apps OnChange.

Suggested output schema (matches `CaptureSignatureResponse`):

| Property | Type | Notes |
| --- | --- | --- |
| `imageBase64` | Text | base64 PNG/JPEG payload |
| `imageDataUrl` | Text | full `data:` URL, ready for an Image control |
| `sigObjBase64` | Text | Wacom SigObj (FSS) for server-side verification |
| `metadata.who` | Text | signer name as the tablet recorded it |
| `metadata.why` | Text | reason of signature |
| `metadata.capturedAtIso` | DateTime | ISO 8601 capture timestamp |
| `strokeCount` | Number | derived from biometric data |

## 3. Persist to Dataverse

```powerapps
OnCapture:
Patch(
  Signatures,
  Defaults(Signatures),
  {
    Document:        gblDocumentRef,
    Signer:          User().FullName,
    Reason:          "Loan agreement",
    Image:           gblConnectorOutput.imageDataUrl,
    SigObj:          gblConnectorOutput.sigObjBase64,
    CapturedAt:      DateTimeValue(gblConnectorOutput.metadata.capturedAtIso),
    StrokeCount:     gblConnectorOutput.strokeCount
  }
)
```

## 4. Error handling

Always check the `ok` flag and the standardised `code` returned by the
connector:

| Code | Meaning |
| --- | --- |
| `WEBHID_UNSUPPORTED` | Run inside Edge/Chrome over HTTPS |
| `TABLET_NOT_FOUND` | STU-540 not plugged in / not authorised |
| `TABLET_PERMISSION_DENIED` | User dismissed the WebHID picker |
| `TABLET_TIMEOUT` | Capture exceeded the configured `captureTimeoutMs` |
| `SIGNATURE_EMPTY` | User pressed OK without drawing |
| `SIGNATURE_CANCELLED` | User pressed Cancel |
| `WACOM_LICENSE_MISSING` / `WACOM_LICENSE_ERROR` | License problems |
