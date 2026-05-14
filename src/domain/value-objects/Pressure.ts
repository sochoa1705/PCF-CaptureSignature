/**
 * Normalized pen pressure between 0.0 (pen up / no contact) and 1.0 (max).
 * The STU-540 firmware reports a raw 16-bit pressure (0..1023 or 0..2047
 * depending on configuration). The conversion to a normalized value lives
 * in the adapter so the domain only deals with the normalized form.
 */
export class Pressure {
  static readonly MIN = 0;
  static readonly MAX = 1;

  private constructor(public readonly value: number) {}

  static of(raw: number, maxRaw = 1023): Pressure {
    if (!Number.isFinite(raw) || raw < 0) {
      throw new RangeError(`Pressure must be a non-negative finite number, got ${raw}`);
    }
    if (maxRaw <= 0) {
      throw new RangeError(`maxRaw must be > 0, got ${maxRaw}`);
    }
    const normalized = Math.min(1, Math.max(0, raw / maxRaw));
    return new Pressure(normalized);
  }

  static zero(): Pressure {
    return new Pressure(0);
  }

  isPenUp(): boolean {
    return this.value === 0;
  }

  toJSON(): number {
    return this.value;
  }
}
