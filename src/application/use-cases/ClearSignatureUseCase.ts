import { DomainError } from '../../domain/errors/DomainError.js';
import { Result } from '../../domain/shared/Result.js';
import { CanvasRendererPort } from '../../ports/CanvasRendererPort.js';
import { LoggerPort } from '../../ports/LoggerPort.js';
import { WacomTabletPort } from '../../ports/WacomTabletPort.js';

export class ClearSignatureUseCase {
  constructor(
    private readonly tablet: WacomTabletPort,
    private readonly renderer: CanvasRendererPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(): Promise<Result<void, DomainError>> {
    this.renderer.clear();
    const r = await this.tablet.clear();
    if (Result.isFail(r)) {
      this.logger.warn('Tablet clear reported error', { msg: r.error.message });
    }
    return Result.ok(undefined);
  }
}
