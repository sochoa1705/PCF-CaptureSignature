import { BrowserCanvasRendererAdapter } from '../../adapters/secondary/BrowserCanvasRendererAdapter.js';
import { ConsoleLoggerAdapter } from '../../adapters/secondary/ConsoleLoggerAdapter.js';
import { FallbackCanvasTabletAdapter } from '../../adapters/secondary/FallbackCanvasTabletAdapter.js';
import { InMemorySignatureRepository } from '../../adapters/secondary/InMemorySignatureRepository.js';
import { WacomSignatureSdkAdapter } from '../../adapters/secondary/WacomSignatureSdkAdapter.js';
import { WebHIDTabletAdapter } from '../../adapters/secondary/WebHIDTabletAdapter.js';
import { ConfigPort, ConnectorConfig } from '../../ports/ConfigPort.js';
import { LoggerPort } from '../../ports/LoggerPort.js';
import { CanvasRendererPort } from '../../ports/CanvasRendererPort.js';
import { SignatureRepositoryPort } from '../../ports/SignatureRepositoryPort.js';
import { SignatureSdkPort } from '../../ports/SignatureSdkPort.js';
import { WacomTabletPort } from '../../ports/WacomTabletPort.js';
import { StaticConfigAdapter } from '../config/WacomConfig.js';
import { buildContainer, ContainerDependencies, ResolvedContainer } from '../di/Container.js';

export interface ConnectorFactoryInput {
  readonly config: ConnectorConfig;
  readonly canvasElement?: HTMLCanvasElement;
  readonly fallbackButtonsContainer?: HTMLElement;
  readonly overrides?: Partial<ContainerDependencies>;
}

/**
 * Composition root. Picks the best transport (WebHID first, fallback
 * second) based on the runtime capabilities and the configuration flag.
 * All wiring decisions live here — no other file knows which concrete
 * class is bound to which port.
 */
export function buildConnector(input: ConnectorFactoryInput): ResolvedContainer {
  const logger: LoggerPort = input.overrides?.logger ?? new ConsoleLoggerAdapter('debug');
  const config: ConfigPort = input.overrides?.config ?? new StaticConfigAdapter(input.config);

  const { tablet, tabletWidth, tabletHeight } = input.overrides?.tablet
    ? { tablet: input.overrides.tablet, tabletWidth: 800, tabletHeight: 480 }
    : pickTransport(input, logger);

  const sdk: SignatureSdkPort =
    input.overrides?.sdk ?? new WacomSignatureSdkAdapter(logger);

  const renderer: CanvasRendererPort =
    input.overrides?.renderer ??
    new BrowserCanvasRendererAdapter({
      inkColor: input.config.ui.inkColor ?? '#0a205a',
      inkWidthPx: input.config.ui.inkWidthPx ?? 2,
      tabletWidth,
      tabletHeight,
    });

  if (input.canvasElement && renderer instanceof BrowserCanvasRendererAdapter) {
    renderer.attach(input.canvasElement);
  }

  const repository: SignatureRepositoryPort =
    input.overrides?.repository ?? new InMemorySignatureRepository();

  return buildContainer({ config, logger, tablet, sdk, renderer, repository });
}

function pickTransport(
  input: ConnectorFactoryInput,
  logger: LoggerPort,
): { tablet: WacomTabletPort; tabletWidth: number; tabletHeight: number } {
  const wantsWebHid = input.config.preferWebHid;
  const navWithHid = globalThis.navigator as { hid?: unknown } | undefined;
  if (wantsWebHid && !!navWithHid?.hid) {
    // STU-540 uses a 9600×6000 logical coordinate space (higher resolution
    // than the 800×480 LCD). The renderer must scale accordingly.
    return { tablet: new WebHIDTabletAdapter(logger), tabletWidth: 9600, tabletHeight: 6000 };
  }
  logger.warn(
    'WebHID unavailable or disabled by config — falling back to canvas tablet adapter',
  );
  const fallback = new FallbackCanvasTabletAdapter(logger);
  if (input.canvasElement) {
    fallback.bindToCanvas(input.canvasElement, input.fallbackButtonsContainer);
  }
  // Fallback adapter emits pointer coordinates in canvas pixel space (800×480).
  return { tablet: fallback, tabletWidth: 800, tabletHeight: 480 };
}
