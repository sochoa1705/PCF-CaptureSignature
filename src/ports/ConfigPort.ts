/**
 * Runtime configuration consumed by adapters. Kept as a port so the
 * connector can be wired to environment variables, Power Apps parameters,
 * a remote config service or hardcoded defaults — interchangeably.
 *
 * Note about Wacom licenses: licenses must NEVER be hardcoded. The
 * preferred flow is to fetch them at runtime from a backend that has
 * authenticated the caller (e.g. a Power Automate flow protected by Entra
 * ID) and hand them to this port.
 */
export interface WacomLicense {
  readonly licenseString: string;
  readonly issuedTo?: string;
  readonly expiresAtIso?: string;
}

export interface TabletUiConfig {
  /** Title shown on the tablet's LCD prior to signing. */
  readonly title: string;
  /** Reason of signature (e.g. "I agree to the terms"). */
  readonly reason: string;
  /** Localised labels for the on-tablet soft buttons. */
  readonly buttons: {
    readonly clear: string;
    readonly cancel: string;
    readonly ok: string;
  };
  /** Optional background image (PNG/JPEG base64) to display behind ink. */
  readonly backgroundImageBase64?: string;
  /** Pen colour and width in CSS units. */
  readonly inkColor?: string;
  readonly inkWidthPx?: number;
}

export interface ConnectorConfig {
  readonly license: WacomLicense;
  readonly ui: TabletUiConfig;
  readonly captureTimeoutMs: number;
  readonly autoReconnect: boolean;
  readonly maxReconnectAttempts: number;
  readonly preferWebHid: boolean;
  /** Path to the canvas DOM element used for visual feedback / fallback. */
  readonly canvasSelector?: string;
}

export interface ConfigPort {
  get(): ConnectorConfig;
  reload(): Promise<ConnectorConfig>;
}
