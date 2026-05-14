import { ConfigPort, ConnectorConfig } from '../../ports/ConfigPort.js';

export const DEFAULT_CONNECTOR_CONFIG: Omit<ConnectorConfig, 'license'> = {
  ui: {
    title: 'Please sign below',
    reason: 'Document acceptance',
    buttons: { clear: 'Clear', cancel: 'Cancel', ok: 'OK' },
    inkColor: '#0a205a',
    inkWidthPx: 2,
  },
  captureTimeoutMs: 120_000,
  autoReconnect: true,
  maxReconnectAttempts: 3,
  preferWebHid: true,
};

/**
 * Static, in-memory ConfigPort implementation. The caller passes a fully
 * formed ConnectorConfig — useful for testing and for the PCF wrapper
 * that reads its license from a control input property.
 */
export class StaticConfigAdapter implements ConfigPort {
  private current: ConnectorConfig;
  constructor(initial: ConnectorConfig) {
    this.current = initial;
  }
  get(): ConnectorConfig {
    return this.current;
  }
  async reload(): Promise<ConnectorConfig> {
    return this.current;
  }
  update(patch: Partial<ConnectorConfig>): void {
    this.current = { ...this.current, ...patch } as ConnectorConfig;
  }
}

/**
 * Convenience builder so consumers can write
 *   buildConfig({ license: { licenseString: '…' } })
 * and have the rest of the values default sensibly.
 */
export function buildConfig(input: {
  license: ConnectorConfig['license'];
  overrides?: Partial<ConnectorConfig>;
}): ConnectorConfig {
  return {
    ...DEFAULT_CONNECTOR_CONFIG,
    ...input.overrides,
    license: input.license,
    ui: {
      ...DEFAULT_CONNECTOR_CONFIG.ui,
      ...(input.overrides?.ui ?? {}),
      buttons: {
        ...DEFAULT_CONNECTOR_CONFIG.ui.buttons,
        ...(input.overrides?.ui?.buttons ?? {}),
      },
    },
  };
}
