import { CancelSignatureUseCase } from '../../application/use-cases/CancelSignatureUseCase.js';
import { CaptureSignatureUseCase } from '../../application/use-cases/CaptureSignatureUseCase.js';
import { ClearSignatureUseCase } from '../../application/use-cases/ClearSignatureUseCase.js';
import { ConnectTabletUseCase } from '../../application/use-cases/ConnectTabletUseCase.js';
import { DisconnectTabletUseCase } from '../../application/use-cases/DisconnectTabletUseCase.js';
import { GetSignatureImageUseCase } from '../../application/use-cases/GetSignatureImageUseCase.js';
import { SignatureCaptureOrchestrator } from '../../application/services/SignatureCaptureOrchestrator.js';
import { ConfigPort } from '../../ports/ConfigPort.js';
import { LoggerPort } from '../../ports/LoggerPort.js';
import { CanvasRendererPort } from '../../ports/CanvasRendererPort.js';
import { SignatureRepositoryPort } from '../../ports/SignatureRepositoryPort.js';
import { SignatureSdkPort } from '../../ports/SignatureSdkPort.js';
import { WacomTabletPort } from '../../ports/WacomTabletPort.js';

/**
 * Lightweight DI container — explicit constructor injection without a
 * runtime IoC framework. Picked over heavier libraries (Inversify, tsyringe)
 * because we want zero runtime dependencies that would complicate the
 * Power Apps build pipeline.
 */
export interface ContainerDependencies {
  readonly config: ConfigPort;
  readonly logger: LoggerPort;
  readonly tablet: WacomTabletPort;
  readonly sdk: SignatureSdkPort;
  readonly renderer: CanvasRendererPort;
  readonly repository: SignatureRepositoryPort;
}

export interface ResolvedContainer {
  readonly deps: ContainerDependencies;
  readonly useCases: {
    readonly connect: ConnectTabletUseCase;
    readonly capture: CaptureSignatureUseCase;
    readonly disconnect: DisconnectTabletUseCase;
    readonly clear: ClearSignatureUseCase;
    readonly cancel: CancelSignatureUseCase;
    readonly getImage: GetSignatureImageUseCase;
  };
  readonly orchestrator: SignatureCaptureOrchestrator;
}

export function buildContainer(deps: ContainerDependencies): ResolvedContainer {
  const connect = new ConnectTabletUseCase(deps.tablet, deps.sdk, deps.config, deps.logger);
  const capture = new CaptureSignatureUseCase(
    deps.tablet,
    deps.sdk,
    deps.renderer,
    deps.config,
    deps.logger,
  );
  const disconnect = new DisconnectTabletUseCase(deps.tablet, deps.sdk, deps.logger);
  const clear = new ClearSignatureUseCase(deps.tablet, deps.renderer, deps.logger);
  const cancel = new CancelSignatureUseCase(deps.tablet, deps.renderer, deps.logger);
  const getImage = new GetSignatureImageUseCase(deps.sdk);

  const orchestrator = new SignatureCaptureOrchestrator(
    connect,
    capture,
    disconnect,
    deps.config,
    deps.logger,
  );

  return {
    deps,
    useCases: { connect, capture, disconnect, clear, cancel, getImage },
    orchestrator,
  };
}
