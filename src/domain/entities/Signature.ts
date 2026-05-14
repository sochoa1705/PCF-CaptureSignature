import { PenPoint } from './PenPoint.js';
import { SignatureMetadata } from './SignatureMetadata.js';

/**
 * Aggregate root representing a captured signature. Holds the full
 * biometric stroke list plus the metadata required to bind the signature
 * to a person, intent, and moment in time.
 *
 * The class deliberately keeps no reference to any vendor SDK type. The
 * adapter layer is responsible for translating between PenPoint[] and the
 * vendor SigObj structure.
 */
export class Signature {
  private constructor(
    private readonly _points: readonly PenPoint[],
    public readonly metadata: SignatureMetadata,
    public readonly width: number,
    public readonly height: number,
  ) {}

  static create(params: {
    points: readonly PenPoint[];
    metadata: SignatureMetadata;
    width: number;
    height: number;
  }): Signature {
    if (!params.points || params.points.length === 0) {
      throw new Error('Signature must contain at least one PenPoint');
    }
    if (params.width <= 0 || params.height <= 0) {
      throw new Error(
        `Signature canvas size must be positive (got ${params.width}x${params.height})`,
      );
    }
    return new Signature(
      Object.freeze([...params.points]),
      params.metadata,
      params.width,
      params.height,
    );
  }

  get points(): readonly PenPoint[] {
    return this._points;
  }

  get strokeCount(): number {
    // A stroke ends whenever the pen lifts. We count the transitions
    // from pen-down to pen-up to estimate strokes.
    let count = 0;
    let wasDown = false;
    for (const p of this._points) {
      const isDown = !p.isPenUp();
      if (wasDown && !isDown) count++;
      wasDown = isDown;
    }
    if (wasDown) count++;
    return count;
  }

  /** A signature is considered empty if all pen points report no pressure. */
  isEmpty(): boolean {
    return this._points.every((p) => p.isPenUp());
  }
}
