import { Signature } from '../../domain/entities/Signature.js';
import { SignatureImage, SignatureImageFormat } from '../../domain/entities/SignatureCaptureResult.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import { Result } from '../../domain/shared/Result.js';
import { SignatureSdkPort } from '../../ports/SignatureSdkPort.js';

/**
 * Renders an already-captured Signature into another image format/size,
 * for example to produce a thumbnail or a high-DPI print copy without
 * recapturing.
 */
export class GetSignatureImageUseCase {
  constructor(private readonly sdk: SignatureSdkPort) {}

  async execute(params: {
    signature: Signature;
    format: SignatureImageFormat;
    widthPx: number;
    heightPx: number;
    transparent?: boolean;
    inkColor?: string;
    inkWidthPx?: number;
  }): Promise<Result<SignatureImage, DomainError>> {
    return this.sdk.renderImage({
      signature: params.signature,
      format: params.format,
      widthPx: params.widthPx,
      heightPx: params.heightPx,
      inkColor: params.inkColor,
      inkWidthPx: params.inkWidthPx,
      transparent: params.transparent,
    });
  }
}
