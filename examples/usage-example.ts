/**
 * End-to-end programmatic usage of the connector. Run this file in a
 * browser context (e.g. as part of an integration test) where:
 *   - the Wacom Signature SDK script has been loaded (window.WacomGSS),
 *   - WebHID is available (Chromium-based browser on HTTPS),
 *   - a Wacom STU-540 is plugged in.
 */

import { WacomStu540Connector, Result } from '../src';

async function main(): Promise<void> {
  const license = await fetchLicenseFromBackend();

  // Acquire a canvas the connector will draw real-time strokes onto.
  const canvas = document.getElementById('preview') as HTMLCanvasElement;
  if (!canvas) throw new Error('Missing #preview canvas');

  const connector = WacomStu540Connector.withLicense(license, {
    canvasElement: canvas,
    overrides: {
      ui: {
        title: 'Sign the contract',
        reason: 'I accept the terms and conditions',
        buttons: { clear: 'Borrar', cancel: 'Cancelar', ok: 'Aceptar' },
        inkColor: '#000080',
        inkWidthPx: 2.5,
      },
      captureTimeoutMs: 90_000,
    },
  });

  const result = await connector.captureSignature({
    signerName: 'Sebastián Ochoa',
    reason: 'Contract acceptance',
    application: 'Contract Portal v2',
    documentHash: await hashCurrentDocument(),
    outputFormat: 'png',
    outputWidthPx: 1200,
    outputHeightPx: 720,
    transparentBackground: false,
  });

  if (Result.isFail(result)) {
    console.error('Capture failed', result.error.code, result.error.message);
    return;
  }

  const r = result.value;
  console.info(`Captured ${r.strokeCount} strokes at ${r.metadata.capturedAtIso}`);

  // 1. Display the rendered image in the page.
  const img = document.createElement('img');
  img.src = r.imageDataUrl;
  document.body.appendChild(img);

  // 2. Persist the SigObj + biometric points to a backend for verification.
  await fetch('/api/signatures', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sigObjBase64: r.sigObjBase64,
      biometric: r.biometricPoints,
      metadata: r.metadata,
    }),
  });
}

async function fetchLicenseFromBackend(): Promise<string> {
  // Always fetch licenses from a backend that has authenticated the user
  // (e.g. a Power Automate flow protected by Entra ID). Never hardcode.
  const response = await fetch('/api/wacom/license');
  if (!response.ok) throw new Error(`License fetch failed: ${response.status}`);
  const { license } = await response.json();
  return license;
}

async function hashCurrentDocument(): Promise<string> {
  // Compute a SHA-256 hash of the contract bytes for non-repudiation.
  // The exact source depends on the host application.
  const text = document.documentElement.outerHTML;
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

void main();
