import { Coordinates } from '../value-objects/Coordinates.js';
import { Pressure } from '../value-objects/Pressure.js';

/**
 * A single sample from the pen. The combination of (coordinates, pressure,
 * timestamp) forms the smallest unit of biometric data the SDK consumes
 * to build a SigObj that includes both visual and biometric information.
 */
export class PenPoint {
  private constructor(
    public readonly coordinates: Coordinates,
    public readonly pressure: Pressure,
    public readonly timestampMs: number,
  ) {}

  static create(params: {
    x: number;
    y: number;
    pressure: number;
    maxPressure?: number;
    timestampMs?: number;
  }): PenPoint {
    const timestampMs = params.timestampMs ?? Date.now();
    return new PenPoint(
      Coordinates.of(params.x, params.y),
      Pressure.of(params.pressure, params.maxPressure),
      timestampMs,
    );
  }

  isPenUp(): boolean {
    return this.pressure.isPenUp();
  }

  toJSON(): { x: number; y: number; p: number; t: number } {
    return {
      x: this.coordinates.x,
      y: this.coordinates.y,
      p: this.pressure.value,
      t: this.timestampMs,
    };
  }
}
