import { PenPoint } from '../domain/entities/PenPoint.js';
import { TabletInfo } from '../domain/entities/TabletInfo.js';
import { Result } from '../domain/shared/Result.js';
import { DomainError } from '../domain/errors/DomainError.js';
import { TabletUiConfig } from './ConfigPort.js';

export type TabletButton = 'clear' | 'cancel' | 'ok';

export interface TabletEvent {
  type: 'pen' | 'button' | 'connected' | 'disconnected';
  penPoint?: PenPoint;
  button?: TabletButton;
  info?: TabletInfo;
  error?: DomainError;
}

export type TabletEventListener = (event: TabletEvent) => void;

/**
 * Hardware-level contract for any Wacom tablet (WebHID, USB-serial bridge,
 * STU SDK websocket, …). Use cases depend on this port — never on a
 * specific adapter — so swapping transports is a localised change.
 */
export interface WacomTabletPort {
  isSupported(): boolean;
  isConnected(): boolean;
  connect(): Promise<Result<TabletInfo, DomainError>>;
  disconnect(): Promise<Result<void, DomainError>>;

  /** Push the UI (background, buttons, prompts) to the tablet's LCD. */
  renderUi(ui: TabletUiConfig): Promise<Result<void, DomainError>>;

  /** Clear the on-tablet ink and reset the in-flight signature. */
  clear(): Promise<Result<void, DomainError>>;

  /** Subscribe to pen / button events. Returns an unsubscribe handle. */
  onEvent(listener: TabletEventListener): () => void;
}
