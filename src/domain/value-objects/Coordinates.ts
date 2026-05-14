/**
 * Immutable 2D coordinate in the tablet's logical coordinate system.
 * For the Wacom STU-540 the reported range is approximately
 * 0..800 (x) and 0..480 (y) per the STU SDK device descriptor.
 */
export class Coordinates {
  private constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}

  static of(x: number, y: number): Coordinates {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError(`Coordinates must be finite numbers, got (${x}, ${y})`);
    }
    return new Coordinates(x, y);
  }

  equals(other: Coordinates): boolean {
    return this.x === other.x && this.y === other.y;
  }

  toJSON(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}
