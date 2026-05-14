import { PenPoint } from '../domain/entities/PenPoint.js';
import { Signature } from '../domain/entities/Signature.js';
import { SignatureImage, SignatureImageFormat } from '../domain/entities/SignatureCaptureResult.js';
import { SignatureMetadata } from '../domain/entities/SignatureMetadata.js';
import { Result } from '../domain/shared/Result.js';
import { DomainError } from '../domain/errors/DomainError.js';
import { WacomLicense } from './ConfigPort.js';

/**
 * Output of building a SigObj. Adapters using the Wacom Signature SDK
 * return both the serialized SigObj (FSS / ISO 19794-7) and the original
 * domain Signature so the application layer doesn't need to re-walk the
 * point list.
 */
export interface SigObjBuildResult {
  readonly signature: Signature;
  /** Serialized SigObj as base64 (Forensic Signature Format by default). */
  readonly sigObjBase64: string;
}

export interface SignatureRenderRequest {
  readonly signature: Signature;
  readonly format: SignatureImageFormat;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly inkColor?: string;
  readonly inkWidthPx?: number;
  /** Transparent background when true; otherwise white. */
  readonly transparent?: boolean;
}

/**
 * Wraps the Wacom Signature SDK for JavaScript. Keeping the SDK behind a
 * port keeps the rest of the codebase free of any reference to
 * `WacomGSS`, `SignatureSDK` globals or SDK-specific types.
 */
export interface SignatureSdkPort {
  initialise(license: WacomLicense): Promise<Result<void, DomainError>>;
  buildSigObj(params: {
    points: readonly PenPoint[];
    metadata: SignatureMetadata;
    width: number;
    height: number;
  }): Promise<Result<SigObjBuildResult, DomainError>>;
  renderImage(request: SignatureRenderRequest): Promise<Result<SignatureImage, DomainError>>;
  dispose(): Promise<void>;
}
