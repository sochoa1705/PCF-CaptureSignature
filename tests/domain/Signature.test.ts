import { describe, expect, it } from 'vitest';

import { PenPoint } from '../../src/domain/entities/PenPoint';
import { Signature } from '../../src/domain/entities/Signature';
import { SignatureMetadata } from '../../src/domain/entities/SignatureMetadata';

const metadata = SignatureMetadata.fromInput({
  who: 'Test User',
  why: 'Test',
});

describe('Signature', () => {
  it('counts strokes by detecting pen-up transitions', () => {
    const points = [
      PenPoint.create({ x: 1, y: 1, pressure: 1 }),
      PenPoint.create({ x: 2, y: 2, pressure: 1 }),
      PenPoint.create({ x: 2, y: 2, pressure: 0 }), // pen up
      PenPoint.create({ x: 5, y: 5, pressure: 1 }),
      PenPoint.create({ x: 6, y: 6, pressure: 1 }),
    ];
    const sig = Signature.create({ points, metadata, width: 800, height: 480 });
    expect(sig.strokeCount).toBe(2);
    expect(sig.isEmpty()).toBe(false);
  });

  it('treats all-pen-up samples as empty', () => {
    const points = [PenPoint.create({ x: 1, y: 1, pressure: 0 })];
    const sig = Signature.create({ points, metadata, width: 800, height: 480 });
    expect(sig.isEmpty()).toBe(true);
  });

  it('refuses non-positive canvas dimensions', () => {
    const points = [PenPoint.create({ x: 1, y: 1, pressure: 1 })];
    expect(() =>
      Signature.create({ points, metadata, width: 0, height: 100 }),
    ).toThrow(/canvas size/);
  });

  it('requires at least one point', () => {
    expect(() =>
      Signature.create({ points: [], metadata, width: 100, height: 100 }),
    ).toThrow(/at least one/);
  });
});
