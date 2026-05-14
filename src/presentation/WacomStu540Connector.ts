import { PowerAppsAdapter } from '../adapters/primary/PowerAppsAdapter.js';
import { CaptureSignatureRequest } from '../application/dto/CaptureSignatureRequest.js';
import { CaptureSignatureResponse } from '../application/dto/CaptureSignatureResponse.js';
import { DomainError } from '../domain/errors/DomainError.js';
import { Result } from '../domain/shared/Result.js';
import { ConnectorConfig } from '../ports/ConfigPort.js';
import { buildConfig } from '../infrastructure/config/WacomConfig.js';
import { buildConnector } from '../infrastructure/factory/ConnectorFactory.js';
import { ContainerDependencies, ResolvedContainer } from '../infrastructure/di/Container.js';

export interface WacomStu540ConnectorOptions {
  readonly config: ConnectorConfig;
  readonly canvasElement?: HTMLCanvasElement;
  readonly fallbackButtonsContainer?: HTMLElement;
  readonly overrides?: Partial<ContainerDependencies>;
}

/**
 * High-level façade exposed to integrators. It hides the use-case
 * topology behind three method calls (connect / capture / disconnect)
 * while still letting advanced callers reach into the container if they
 * need finer-grained control.
 *
 * The class is deliberately stateless beyond a reference to the resolved
 * container so it is safe to allocate, use, and discard per Power Apps
 * screen visit.
 */
export class WacomStu540Connector {
  private constructor(private readonly container: ResolvedContainer) {}

  static create(options: WacomStu540ConnectorOptions): WacomStu540Connector {
    return new WacomStu540Connector(
      buildConnector({
        config: options.config,
        canvasElement: options.canvasElement,
        fallbackButtonsContainer: options.fallbackButtonsContainer,
        overrides: options.overrides,
      }),
    );
  }

  static withLicense(licenseString: string, options?: {
    canvasElement?: HTMLCanvasElement;
    fallbackButtonsContainer?: HTMLElement;
    overrides?: Partial<ConnectorConfig>;
  }): WacomStu540Connector {
    const config = buildConfig({
      license: { licenseString },
      overrides: options?.overrides,
    });
    return WacomStu540Connector.create({
      config,
      canvasElement: options?.canvasElement,
      fallbackButtonsContainer: options?.fallbackButtonsContainer,
    });
  }

  /** Connect, capture, disconnect — the common case. */
  async captureSignature(
    request: CaptureSignatureRequest,
  ): Promise<Result<CaptureSignatureResponse, DomainError>> {
    const r = await this.container.orchestrator.run(request);
    if (Result.isFail(r)) return r;
    return Result.ok(CaptureSignatureResponse.fromResult(r.value));
  }

  /** Wire a `postMessage` bridge for iframe-based Power Apps embedding. */
  exposeToPowerAppsViaPostMessage(allowedOrigin: string | RegExp = '*'): () => void {
    const adapter = new PowerAppsAdapter(
      this.container.orchestrator,
      this.container.deps.logger,
    );
    return adapter.attachPostMessageBridge(allowedOrigin);
  }

  /** Re-render an already-captured signature in a different image format. */
  async getSignatureImage(
    ...args: Parameters<ResolvedContainer['useCases']['getImage']['execute']>
  ) {
    return this.container.useCases.getImage.execute(...args);
  }

  /** Programmatic cancel for the in-flight capture. */
  async cancel(reason?: string) {
    return this.container.useCases.cancel.execute(reason);
  }

  /** Escape hatch for advanced scenarios (tests, custom UI). */
  get internal(): ResolvedContainer {
    return this.container;
  }
}
