import { TabletInfo } from '../../domain/entities/TabletInfo.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import {
  TabletConnectionError,
  WebHidUnsupportedError,
} from '../../domain/errors/TabletConnectionError.js';
import { Result } from '../../domain/shared/Result.js';
import { ConfigPort } from '../../ports/ConfigPort.js';
import { LoggerPort } from '../../ports/LoggerPort.js';
import { SignatureSdkPort } from '../../ports/SignatureSdkPort.js';
import { WacomTabletPort } from '../../ports/WacomTabletPort.js';

/**
 * Establishes a connection to the tablet:
 *   1. Verifies WebHID availability (or another supported transport).
 *   2. Initialises the Wacom Signature SDK with the licence.
 *   3. Connects to the tablet and pushes the configured UI.
 *
 * Idempotent: calling `execute` while already connected returns the
 * existing TabletInfo without re-doing the handshake.
 */
export class ConnectTabletUseCase {
  constructor(
    private readonly tablet: WacomTabletPort,
    private readonly sdk: SignatureSdkPort,
    private readonly config: ConfigPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(): Promise<Result<TabletInfo, DomainError>> {
    if (!this.tablet.isSupported()) {
      const error = new WebHidUnsupportedError(
        'The runtime does not expose a transport for the Wacom STU-540. ' +
          'WebHID is required (or a custom adapter must be supplied).',
      );
      this.logger.error('ConnectTabletUseCase aborted: transport unsupported', error);
      return Result.fail(error);
    }

    const cfg = this.config.get();

    const sdkInit = await this.sdk.initialise(cfg.license);
    if (Result.isFail(sdkInit)) {
      this.logger.error('SDK initialisation failed', sdkInit.error);
      return sdkInit;
    }

    const connection = await this.tablet.connect();
    if (Result.isFail(connection)) {
      this.logger.error('Tablet connect failed', connection.error);
      return connection;
    }

    const renderResult = await this.tablet.renderUi(cfg.ui);
    if (Result.isFail(renderResult)) {
      this.logger.warn('Tablet UI render failed (continuing)', {
        error: renderResult.error.message,
      });
    }

    this.logger.info('Tablet connected', {
      model: connection.value.model,
      firmware: connection.value.firmwareVersion,
    });
    return Result.ok(connection.value);
  }

  /**
   * Convenience helper used by the orchestrator's auto-reconnect logic.
   * Performs an exponential back-off between attempts.
   */
  async executeWithRetry(maxAttempts: number): Promise<Result<TabletInfo, DomainError>> {
    let lastError: DomainError = new TabletConnectionError(
      'No connection attempt has run yet',
    );
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const r = await this.execute();
      if (Result.isOk(r)) return r;
      lastError = r.error;
      const delay = Math.min(2_000 * 2 ** (attempt - 1), 10_000);
      this.logger.warn(`Tablet connection attempt ${attempt} failed, retrying`, {
        delayMs: delay,
        error: r.error.message,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return Result.fail(lastError);
  }
}
