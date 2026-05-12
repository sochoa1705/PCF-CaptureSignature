/**
 * Public surface of the Wacom STU-540 connector.
 *
 * Typical consumer code:
 *
 *   import { WacomStu540Connector } from 'wacom-stu540-connector';
 *
 *   const connector = WacomStu540Connector.withLicense(LICENSE, {
 *     canvasElement: document.getElementById('preview') as HTMLCanvasElement,
 *   });
 *
 *   const result = await connector.captureSignature({
 *     signerName: 'Jane Doe',
 *     reason: 'I agree to the contract',
 *   });
 */
export { WacomStu540Connector } from './presentation/WacomStu540Connector.js';

export type { CaptureSignatureRequest } from './application/dto/CaptureSignatureRequest.js';
export type { CaptureSignatureResponse } from './application/dto/CaptureSignatureResponse.js';

export { Result } from './domain/shared/Result.js';
export { Signature } from './domain/entities/Signature.js';
export { SignatureCaptureResult } from './domain/entities/SignatureCaptureResult.js';
export { TabletInfo } from './domain/entities/TabletInfo.js';
export { PenPoint } from './domain/entities/PenPoint.js';
export { SignatureMetadata } from './domain/entities/SignatureMetadata.js';

export * from './domain/errors/index.js';

export type {
  ConfigPort,
  ConnectorConfig,
  TabletUiConfig,
  WacomLicense,
} from './ports/ConfigPort.js';
export type { LoggerPort } from './ports/LoggerPort.js';
export type { WacomTabletPort, TabletEvent, TabletEventListener } from './ports/WacomTabletPort.js';
export type { SignatureSdkPort } from './ports/SignatureSdkPort.js';
export type { CanvasRendererPort } from './ports/CanvasRendererPort.js';
export type { SignatureRepositoryPort } from './ports/SignatureRepositoryPort.js';

export { buildConnector } from './infrastructure/factory/ConnectorFactory.js';
export { buildConfig, StaticConfigAdapter, DEFAULT_CONNECTOR_CONFIG } from './infrastructure/config/WacomConfig.js';

export { ConsoleLoggerAdapter } from './adapters/secondary/ConsoleLoggerAdapter.js';
export { WebHIDTabletAdapter } from './adapters/secondary/WebHIDTabletAdapter.js';
export { FallbackCanvasTabletAdapter } from './adapters/secondary/FallbackCanvasTabletAdapter.js';
export { BrowserCanvasRendererAdapter } from './adapters/secondary/BrowserCanvasRendererAdapter.js';
export { WacomSignatureSdkAdapter } from './adapters/secondary/WacomSignatureSdkAdapter.js';
export { InMemorySignatureRepository } from './adapters/secondary/InMemorySignatureRepository.js';
export { PowerAppsAdapter } from './adapters/primary/PowerAppsAdapter.js';
export type { PowerAppsMessage, PowerAppsResponse } from './adapters/primary/PowerAppsAdapter.js';
