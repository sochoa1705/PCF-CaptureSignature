import { DomainError } from '../../domain/errors/DomainError.js';
import { SignatureCancelledError } from '../../domain/errors/SignatureCaptureError.js';
import { Result } from '../../domain/shared/Result.js';
import { CanvasRendererPort } from '../../ports/CanvasRendererPort.js';
import { LoggerPort } from '../../ports/LoggerPort.js';
import { WacomTabletPort } from '../../ports/WacomTabletPort.js';

/**
 * Cancels a capture session that is currently in flight. Use this when
 * the host application (Power Apps) wants to abort programmatically, for
 * instance because the user navigated away or because a timer in the
 * canvas elapsed.
 */
export class CancelSignatureUseCase {
  constructor(
    private readonly tablet: WacomTabletPort,
    private readonly renderer: CanvasRendererPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(reason = 'Cancelled by host'): Promise<Result<void, DomainError>> {
    this.renderer.clear();
    await this.tablet.clear();
    this.logger.info('Capture cancelled programmatically', { reason });
    // We rely on the orchestrator's listener to translate this into a
    // SignatureCancelledError. Returning success here means the *request
    // to cancel* succeeded — the in-flight capture is rejected separately.
    void new SignatureCancelledError(reason);
    return Result.ok(undefined);
  }
}
