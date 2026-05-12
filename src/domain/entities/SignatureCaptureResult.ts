import { Signature } from './Signature.js';

export type SignatureImageFormat = 'png' | 'jpeg' | 'svg';

export interface SignatureImage {
  readonly format: SignatureImageFormat;
  /** base64 payload — does NOT include the `data:` URL prefix. */
  readonly base64: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * The full payload returned to a caller after a successful capture. Holds
 * (a) the domain Signature with raw biometric points,
 * (b) an opaque SDK signature blob (Wacom SigObj serialized as FSS or
 *     ISO 19794-7) that can be persisted server-side for verification, and
 * (c) one or more rasterized images for preview/printing.
 */
export class SignatureCaptureResult {
  private constructor(
    public readonly signature: Signature,
    public readonly sigObjBase64: string,
    public readonly image: SignatureImage,
    public readonly extraImages: readonly SignatureImage[] = [],
  ) {}

  static create(params: {
    signature: Signature;
    sigObjBase64: string;
    image: SignatureImage;
    extraImages?: readonly SignatureImage[];
  }): SignatureCaptureResult {
    if (!params.sigObjBase64) {
      throw new Error('SignatureCaptureResult requires a serialized SigObj');
    }
    return new SignatureCaptureResult(
      params.signature,
      params.sigObjBase64,
      params.image,
      params.extraImages ?? [],
    );
  }

  toDataUrl(image: SignatureImage = this.image): string {
    if (image.format === 'svg') {
      return `data:image/svg+xml;base64,${image.base64}`;
    }
    return `data:image/${image.format};base64,${image.base64}`;
  }
}
