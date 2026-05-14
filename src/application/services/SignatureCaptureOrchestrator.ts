import { SignatureCaptureResult } from '../../domain/entities/SignatureCaptureResult.js';
import { TabletInfo } from '../../domain/entities/TabletInfo.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import { Result } from '../../domain/shared/Result.js';
import { ConfigPort } from '../../ports/ConfigPort.js';
import { LoggerPort } from '../../ports/LoggerPort.js';
import { CaptureSignatureRequest } from '../dto/CaptureSignatureRequest.js';
import { CaptureSignatureUseCase } from '../use-cases/CaptureSignatureUseCase.js';
import { ConnectTabletUseCase } from '../use-cases/ConnectTabletUseCase.js';
import { DisconnectTabletUseCase } from '../use-cases/DisconnectTabletUseCase.js';

/**
 * Application service exposing the canonical "connect -> capture ->
 * disconnect" flow. Higher-level adapters (PowerAppsAdapter, PCF) call
 * this single method instead of orchestrating the use cases by hand,
 * which keeps the integration surface tiny.
 */
export class SignatureCaptureOrchestrator {
  private currentTablet?: TabletInfo;

  constructor(
    private readonly connectUseCase: ConnectTabletUseCase,
    private readonly captureUseCase: CaptureSignatureUseCase,
    private readonly disconnectUseCase: DisconnectTabletUseCase,
    private readonly config: ConfigPort,
    private readonly logger: LoggerPort,
  ) {}

  async run(
    request: CaptureSignatureRequest,
  ): Promise<Result<SignatureCaptureResult, DomainError>> {
    const cfg = this.config.get();
    const connection = cfg.autoReconnect
      ? await this.connectUseCase.executeWithRetry(cfg.maxReconnectAttempts)
      : await this.connectUseCase.execute();
    if (Result.isFail(connection)) return connection;

    const tabletInfo = connection.value;
    this.currentTablet = tabletInfo;

    try {
      return await this.captureUseCase.execute(request, tabletInfo);
    } finally {
      const dr = await this.disconnectUseCase.execute();
      if (Result.isFail(dr)) {
        this.logger.warn('Disconnect after capture reported error', {
          error: dr.error.message,
        });
      }
      this.currentTablet = undefined;
    }
  }
}
