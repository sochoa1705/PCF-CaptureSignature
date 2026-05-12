import { Signature } from '../../domain/entities/Signature.js';
import { SignatureImage } from '../../domain/entities/SignatureCaptureResult.js';
import { SignatureMetadata } from '../../domain/entities/SignatureMetadata.js';
import { PenPoint } from '../../domain/entities/PenPoint.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import {
  LicenseError,
  LicenseMissingError,
} from '../../domain/errors/LicenseError.js';
import { SignatureRenderError } from '../../domain/errors/SignatureCaptureError.js';
import { Result } from '../../domain/shared/Result.js';
import { LoggerPort } from '../../ports/LoggerPort.js';
import { WacomLicense } from '../../ports/ConfigPort.js';
import {
  SigObjBuildResult,
  SignatureRenderRequest,
  SignatureSdkPort,
} from '../../ports/SignatureSdkPort.js';

/**
 * Minimal structural type for the global `WacomGSS` namespace the
 * Signature SDK for JavaScript installs on `window`. Methods are
 * declared just enough to compile without the SDK typings present.
 *
 * Official package: https://github.com/Wacom-Developer/signature-sdk-js
 */
interface WacomGSSGlobal {
  STU?: { Tablet: new () => unknown };
  SigObj?: new () => WacomSigObjInstance;
  License?: {
    setLicense(license: string): boolean | Promise<boolean>;
  };
}

interface WacomSigObjInstance {
  setIntegrityFields(fields: Record<string, string>): void;
  addPoint(x: number, y: number, p: number, t: number): void;
  setSigText(who: string, why: string, where?: string): void;
  generateSigImage(opts: {
    inkWidth: number;
    inkColor: string;
    width: number;
    height: number;
    backgroundColor?: string;
    padX?: number;
    padY?: number;
    format?: 'png' | 'jpeg' | 'svg';
  }): { base64: string; mimeType: string };
  serialise(format: 'FSS' | 'ISO'): { base64: string };
}

declare global {
  interface Window {
    WacomGSS?: WacomGSSGlobal;
  }
}

/**
 * Bridges the Wacom Signature SDK for JavaScript. Performs license
 * activation, SigObj assembly, and rasterisation. When the SDK globals
 * are missing the adapter falls back to a pure-canvas rasteriser so the
 * rest of the flow keeps working in tests / design-time previews.
 * The fallback SigObj is a tagged JSON envelope, NOT a real SigObj.
 */
export class WacomSignatureSdkAdapter implements SignatureSdkPort {
  private licensed = false;

  constructor(private readonly logger: LoggerPort) {}

  async initialise(license: WacomLicense): Promise<Result<void, DomainError>> {
    if (!license?.licenseString?.trim()) {
      return Result.fail(
        new LicenseMissingError('A Wacom license string is required'),
      );
    }
    const gss = this.getGSS();
    if (!gss?.License) {
      this.logger.warn(
        'WacomGSS global not detected — SignatureSDK adapter will run in fallback mode',
      );
      this.licensed = true;
      return Result.ok(undefined);
    }
    try {
      const accepted = await gss.License.setLicense(license.licenseString);
      if (!accepted) {
        return Result.fail(new LicenseError('Wacom rejected the supplied license string'));
      }
      this.licensed = true;
      this.logger.info('Wacom license accepted');
      return Result.ok(undefined);
    } catch (err) {
      return Result.fail(
        new LicenseError('Unexpected error while activating Wacom license', err),
      );
    }
  }

  async buildSigObj(params: {
    points: readonly PenPoint[];
    metadata: SignatureMetadata;
    width: number;
    height: number;
  }): Promise<Result<SigObjBuildResult, DomainError>> {
    if (!this.licensed) {
      return Result.fail(
        new LicenseMissingError('SDK is not initialised. Call initialise() first.'),
      );
    }
    const signature = Signature.create({
      points: params.points,
      metadata: params.metadata,
      width: params.width,
      height: params.height,
    });

    const gss = this.getGSS();
    if (!gss?.SigObj) {
      this.logger.debug('Building SigObj via JSON fallback (no SDK present)');
      return Result.ok({ signature, sigObjBase64: this.toRawFallbackEnvelope(signature) });
    }

    try {
      const sigObj = new gss.SigObj();
      sigObj.setSigText(
        params.metadata.who,
        params.metadata.why,
        params.metadata.where,
      );
      if (params.metadata.documentHash) {
        sigObj.setIntegrityFields({ documentHash: params.metadata.documentHash });
      }
      for (const p of params.points) {
        sigObj.addPoint(p.coordinates.x, p.coordinates.y, p.pressure.value, p.timestampMs);
      }
      const serialized = sigObj.serialise('FSS');
      return Result.ok({ signature, sigObjBase64: serialized.base64 });
    } catch (err) {
      return Result.fail(
        new SignatureRenderError('Failed to build Wacom SigObj from PenPoints', err),
      );
    }
  }

  async renderImage(req: SignatureRenderRequest): Promise<Result<SignatureImage, DomainError>> {
    const inkColor = req.inkColor ?? '#0a205a';
    const inkWidthPx = req.inkWidthPx ?? 2;
    const gss = this.getGSS();

    if (gss?.SigObj) {
      try {
        const sigObj = new gss.SigObj();
        sigObj.setSigText(
          req.signature.metadata.who,
          req.signature.metadata.why,
          req.signature.metadata.where,
        );
        for (const p of req.signature.points) {
          sigObj.addPoint(p.coordinates.x, p.coordinates.y, p.pressure.value, p.timestampMs);
        }
        const image = sigObj.generateSigImage({
          inkColor,
          inkWidth: inkWidthPx,
          width: req.widthPx,
          height: req.heightPx,
          backgroundColor: req.transparent ? 'transparent' : '#ffffff',
          padX: 8,
          padY: 8,
          format: req.format,
        });
        return Result.ok({
          format: req.format,
          base64: image.base64,
          widthPx: req.widthPx,
          heightPx: req.heightPx,
        });
      } catch (err) {
        return Result.fail(
          new SignatureRenderError('Wacom SDK rasterisation failed', err),
        );
      }
    }

    return this.renderFallback(req, inkColor, inkWidthPx);
  }

  async dispose(): Promise<void> {
    this.licensed = false;
  }

  // ── helpers ────────────────────────────────────────────────────────

  private getGSS(): WacomGSSGlobal | undefined {
    return typeof window === 'undefined' ? undefined : window.WacomGSS;
  }

  private toRawFallbackEnvelope(signature: Signature): string {
    const payload = {
      version: 'fallback-1',
      metadata: signature.metadata,
      width: signature.width,
      height: signature.height,
      points: signature.points.map((p) => p.toJSON()),
    };
    const json = JSON.stringify(payload);
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(json)));
    const NodeBuffer = (globalThis as {
      Buffer?: { from(s: string, e: string): { toString(enc: string): string } };
    }).Buffer;
    if (NodeBuffer) return NodeBuffer.from(json, 'utf-8').toString('base64');
    throw new Error('No base64 encoder available in this runtime');
  }

  private renderFallback(
    req: SignatureRenderRequest,
    inkColor: string,
    inkWidthPx: number,
  ): Result<SignatureImage, DomainError> {
    if (typeof document === 'undefined') {
      return Result.fail(
        new SignatureRenderError(
          'Fallback rasteriser requires a DOM. Pre-render server-side instead.',
        ),
      );
    }
    const canvas = document.createElement('canvas');
    canvas.width = req.widthPx;
    canvas.height = req.heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return Result.fail(new SignatureRenderError('No 2D context for fallback rasteriser'));
    }
    if (!req.transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.strokeStyle = inkColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const sx = canvas.width / req.signature.width;
    const sy = canvas.height / req.signature.height;
    let prev: PenPoint | undefined;
    for (const p of req.signature.points) {
      if (p.isPenUp()) {
        prev = undefined;
        continue;
      }
      const x = p.coordinates.x * sx;
      const y = p.coordinates.y * sy;
      ctx.lineWidth = Math.max(0.5, inkWidthPx * p.pressure.value);
      if (!prev) {
        ctx.beginPath();
        ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = inkColor;
        ctx.fill();
      } else {
        const px = prev.coordinates.x * sx;
        const py = prev.coordinates.y * sy;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      prev = p;
    }
    const mime = req.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const url = canvas.toDataURL(mime);
    return Result.ok({
      format: req.format === 'svg' ? 'png' : req.format,
      base64: url.replace(/^data:image\/[a-z]+;base64,/, ''),
      widthPx: req.widthPx,
      heightPx: req.heightPx,
    });
  }
}
