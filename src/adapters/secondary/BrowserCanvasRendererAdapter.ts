import { PenPoint } from '../../domain/entities/PenPoint.js';
import { SignatureRenderError } from '../../domain/errors/SignatureCaptureError.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import { Result } from '../../domain/shared/Result.js';
import { CanvasRendererPort } from '../../ports/CanvasRendererPort.js';

interface RendererOptions {
  readonly inkColor: string;
  readonly inkWidthPx: number;
  readonly tabletWidth: number;
  readonly tabletHeight: number;
}

/**
 * Renders PenPoints to a host <canvas> using the 2D context. Maps the
 * tablet's logical coordinate range onto the canvas pixel space so the
 * rendered preview matches what the user is drawing on the LCD.
 */
export class BrowserCanvasRendererAdapter implements CanvasRendererPort {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;

  constructor(private readonly options: RendererOptions) {}

  attach(canvasElement: HTMLCanvasElement): void {
    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
      throw new SignatureRenderError(
        'Failed to acquire 2D rendering context from the canvas element',
      );
    }
    this.canvas = canvasElement;
    this.ctx = ctx;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.options.inkColor;
    this.ctx.lineWidth = this.options.inkWidthPx;
  }

  detach(): void {
    this.clear();
    this.canvas = undefined;
    this.ctx = undefined;
  }

  drawPenPoint(point: PenPoint, previous?: PenPoint): Result<void, DomainError> {
    if (!this.ctx || !this.canvas) {
      return Result.fail(
        new SignatureRenderError('Renderer has no attached canvas'),
      );
    }
    if (point.isPenUp()) return Result.ok(undefined);

    const mapped = this.toCanvasSpace(point);
    if (previous && !previous.isPenUp()) {
      const prev = this.toCanvasSpace(previous);
      this.ctx.beginPath();
      this.ctx.moveTo(prev.x, prev.y);
      this.ctx.lineTo(mapped.x, mapped.y);
      // Use pressure to modulate the stroke width.
      this.ctx.lineWidth = Math.max(0.5, this.options.inkWidthPx * point.pressure.value);
      this.ctx.stroke();
    } else {
      this.ctx.beginPath();
      this.ctx.arc(mapped.x, mapped.y, this.options.inkWidthPx / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    return Result.ok(undefined);
  }

  clear(): void {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  toBase64Png(): string {
    if (!this.canvas) return '';
    const url = this.canvas.toDataURL('image/png');
    return url.replace(/^data:image\/png;base64,/, '');
  }

  private toCanvasSpace(point: PenPoint): { x: number; y: number } {
    if (!this.canvas) return { x: 0, y: 0 };
    const sx = this.canvas.width / this.options.tabletWidth;
    const sy = this.canvas.height / this.options.tabletHeight;
    return {
      x: point.coordinates.x * sx,
      y: point.coordinates.y * sy,
    };
  }
}
