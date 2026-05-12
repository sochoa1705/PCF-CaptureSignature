import { PenPoint } from '../domain/entities/PenPoint.js';
import { Result } from '../domain/shared/Result.js';
import { DomainError } from '../domain/errors/DomainError.js';

/**
 * Visual feedback on the host browser canvas. Mirrors the strokes the
 * user is drawing on the tablet so people watching the screen also see
 * the signature appear in real time.
 */
export interface CanvasRendererPort {
  attach(canvasElement: HTMLCanvasElement): void;
  detach(): void;
  drawPenPoint(point: PenPoint, previous?: PenPoint): Result<void, DomainError>;
  clear(): void;
  /** Snapshot the canvas to a base64 PNG (without the data: prefix). */
  toBase64Png(): string;
}
