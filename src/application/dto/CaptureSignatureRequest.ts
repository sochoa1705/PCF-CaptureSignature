import { SignatureImageFormat } from '../../domain/entities/SignatureCaptureResult.js';

export interface CaptureSignatureRequest {
  readonly signerName: string;
  readonly reason: string;
  readonly application?: string;
  readonly documentHash?: string;
  readonly outputFormat?: SignatureImageFormat;
  readonly outputWidthPx?: number;
  readonly outputHeightPx?: number;
  readonly transparentBackground?: boolean;
  /** Override the global capture timeout for this single call (ms). */
  readonly timeoutMs?: number;
}
