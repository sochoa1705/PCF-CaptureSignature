import { DomainError } from '../../domain/errors/DomainError.js';
import { Result } from '../../domain/shared/Result.js';
import { LoggerPort } from '../../ports/LoggerPort.js';
import { SignatureSdkPort } from '../../ports/SignatureSdkPort.js';
import { WacomTabletPort } from '../../ports/WacomTabletPort.js';

/**
 * Cleanly tears down the tablet session: clears the on-tablet ink,
 * disconnects from the transport, and disposes any SDK resources.
 */
export class DisconnectTabletUseCase {
  constructor(
    private readonly tablet: WacomTabletPort,
    private readonly sdk: SignatureSdkPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(): Promise<Result<void, DomainError>> {
    if (this.tablet.isConnected()) {
      await this.tablet.clear();
      const disconnection = await this.tablet.disconnect();
      if (Result.isFail(disconnection)) {
        this.logger.warn('Tablet disconnect reported error', {
          error: disconnection.error.message,
        });
      }
    }
    await this.sdk.dispose();
    this.logger.info('Tablet disconnected and SDK disposed');
    return Result.ok(undefined);
  }
}
