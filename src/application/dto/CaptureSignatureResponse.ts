import { SignatureCaptureResult } from '../../domain/entities/SignatureCaptureResult.js';

/**
 * Flat, JSON-friendly projection of a SignatureCaptureResult. The shape is
 * stable so it can be safely consumed across the Power Apps boundary
 * (which uses JSON serialization for everything that crosses iframes /
 * Custom Connectors / PCF event payloads).
 */
export interface CaptureSignatureResponse {
  readonly imageDataUrl: string;
  readonly imageBase64: string;
  readonly imageFormat: 'png' | 'jpeg' | 'svg';
  readonly imageWidthPx: number;
  readonly imageHeightPx: number;
  readonly sigObjBase64: string;
  readonly biometricPoints: ReadonlyArray<{
    x: number;
    y: number;
    p: number;
    t: number;
  }>;
  readonly metadata: {
    readonly who: string;
    readonly why: string;
    readonly where?: string;
    readonly capturedAtIso: string;
    readonly application?: string;
    readonly documentHash?: string;
  };
  readonly strokeCount: number;
}

export const CaptureSignatureResponse = {
  fromResult(result: SignatureCaptureResult): CaptureSignatureResponse {
    return {
      imageDataUrl: result.toDataUrl(),
      imageBase64: result.image.base64,
      imageFormat: result.image.format,
      imageWidthPx: result.image.widthPx,
      imageHeightPx: result.image.heightPx,
      sigObjBase64: result.sigObjBase64,
      biometricPoints: result.signature.points.map((p) => p.toJSON()),
      metadata: {
        who: result.signature.metadata.who,
        why: result.signature.metadata.why,
        where: result.signature.metadata.where,
        capturedAtIso: result.signature.metadata.capturedAtIso,
        application: result.signature.metadata.application,
        documentHash: result.signature.metadata.documentHash,
      },
      strokeCount: result.signature.strokeCount,
    };
  },
};
