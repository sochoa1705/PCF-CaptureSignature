/**
 * Skeleton of a PowerApps Component Framework (PCF) control that wraps
 * the Wacom STU-540 connector. The PCF runtime instantiates the class,
 * passes a container HTMLDivElement and a context object, and expects a
 * matching property bag back from `getOutputs`.
 *
 * Build with `pac pcf init` + `npm run build`, then upload via the
 * Power Platform CLI: `pac pcf push --publisher-prefix <prefix>`.
 */

import {
  WacomStu540Connector,
  type CaptureSignatureRequest,
  type CaptureSignatureResponse,
} from '../src';

// Minimal type stubs for the PCF host. The real `ComponentFramework` types
// are provided by `pcf-scripts` at build time.
interface IInputs {
  license: { raw: string | null };
  signerName: { raw: string | null };
  reason: { raw: string | null };
  documentHash: { raw: string | null };
}
interface IOutputs {
  signatureBase64?: string;
  signatureDataUrl?: string;
  sigObjBase64?: string;
  strokeCount?: number;
  capturedAtIso?: string;
  errorCode?: string;
  errorMessage?: string;
}
interface IPropBag<T> {
  parameters: T;
  factory: { requestRender(): void };
}

export class WacomStu540PcfControl {
  private container!: HTMLDivElement;
  private connector!: WacomStu540Connector;
  private notifyOutputChanged!: () => void;
  private outputs: IOutputs = {};

  init(
    context: IPropBag<IInputs>,
    notifyOutputChanged: () => void,
    _state: unknown,
    container: HTMLDivElement,
  ): void {
    this.container = container;
    this.notifyOutputChanged = notifyOutputChanged;

    this.container.innerHTML = `
      <div style="display:grid;gap:8px;font-family:Segoe UI,sans-serif">
        <canvas id="wacom-canvas" width="800" height="480"
                style="border:1px solid #ccc;border-radius:6px;background:#fff"></canvas>
        <div id="wacom-buttons" style="display:flex;gap:8px"></div>
        <button id="wacom-go" style="padding:8px 16px">Capture signature</button>
        <div id="wacom-status" style="font-size:12px;color:#555"></div>
      </div>
    `;
    const canvas = this.container.querySelector<HTMLCanvasElement>('#wacom-canvas')!;
    const buttons = this.container.querySelector<HTMLDivElement>('#wacom-buttons')!;

    const license = context.parameters.license.raw;
    if (!license) {
      this.setStatus('License input is empty', true);
      return;
    }

    this.connector = WacomStu540Connector.withLicense(license, {
      canvasElement: canvas,
      fallbackButtonsContainer: buttons,
    });

    this.container.querySelector('#wacom-go')!.addEventListener('click', () =>
      this.runCapture(context),
    );
  }

  updateView(_context: IPropBag<IInputs>): void {
    // No-op; the inputs only matter at capture time.
  }

  getOutputs(): IOutputs {
    return this.outputs;
  }

  destroy(): void {
    // Release WebHID handles when the control is unmounted.
    void this.connector?.internal.useCases.disconnect.execute();
  }

  private async runCapture(context: IPropBag<IInputs>): Promise<void> {
    this.setStatus('Capturing…');
    const request: CaptureSignatureRequest = {
      signerName: context.parameters.signerName.raw ?? 'Unknown',
      reason: context.parameters.reason.raw ?? 'Signature',
      documentHash: context.parameters.documentHash.raw ?? undefined,
      outputFormat: 'png',
    };
    const result = await this.connector.captureSignature(request);
    if (result.ok) {
      const value: CaptureSignatureResponse = result.value;
      this.outputs = {
        signatureBase64: value.imageBase64,
        signatureDataUrl: value.imageDataUrl,
        sigObjBase64: value.sigObjBase64,
        strokeCount: value.strokeCount,
        capturedAtIso: value.metadata.capturedAtIso,
        errorCode: undefined,
        errorMessage: undefined,
      };
      this.setStatus(`Captured ${value.strokeCount} strokes`);
    } else {
      this.outputs = {
        ...this.outputs,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      };
      this.setStatus(`Failed: ${result.error.message}`, true);
    }
    this.notifyOutputChanged();
  }

  private setStatus(text: string, isError = false): void {
    const el = this.container.querySelector<HTMLDivElement>('#wacom-status')!;
    el.textContent = text;
    el.style.color = isError ? '#b3261e' : '#555';
  }
}
