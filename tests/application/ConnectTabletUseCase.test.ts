import { describe, expect, it, vi } from 'vitest';

import { ConnectTabletUseCase } from '../../src/application/use-cases/ConnectTabletUseCase';
import { TabletInfo } from '../../src/domain/entities/TabletInfo';
import { Result } from '../../src/domain/shared/Result';
import { WebHidUnsupportedError } from '../../src/domain/errors/TabletConnectionError';
import { ConsoleLoggerAdapter } from '../../src/adapters/secondary/ConsoleLoggerAdapter';
import { StaticConfigAdapter, buildConfig } from '../../src/infrastructure/config/WacomConfig';

const config = new StaticConfigAdapter(
  buildConfig({ license: { licenseString: 'TEST-LICENSE' } }),
);

const sampleInfo = TabletInfo.create({
  id: 'stub',
  model: 'STU-540',
  firmwareVersion: '1.0',
  capabilities: {
    screenWidthPx: 800,
    screenHeightPx: 480,
    tabletWidth: 800,
    tabletHeight: 480,
    maxPressure: 1023,
    maxReportRateHz: 200,
    hasColorScreen: true,
  },
});

describe('ConnectTabletUseCase', () => {
  it('fails fast when the transport is unsupported', async () => {
    const tablet = {
      isSupported: () => false,
      isConnected: () => false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      renderUi: vi.fn(),
      clear: vi.fn(),
      onEvent: vi.fn(() => () => undefined),
    };
    const sdk = {
      initialise: vi.fn(),
      buildSigObj: vi.fn(),
      renderImage: vi.fn(),
      dispose: vi.fn(),
    };
    const uc = new ConnectTabletUseCase(
      tablet as never,
      sdk as never,
      config,
      new ConsoleLoggerAdapter('error'),
    );
    const r = await uc.execute();
    expect(Result.isFail(r) && r.error).toBeInstanceOf(WebHidUnsupportedError);
    expect(tablet.connect).not.toHaveBeenCalled();
    expect(sdk.initialise).not.toHaveBeenCalled();
  });

  it('initialises SDK then connects when supported', async () => {
    const tablet = {
      isSupported: () => true,
      isConnected: () => false,
      connect: vi.fn(async () => Result.ok(sampleInfo)),
      disconnect: vi.fn(),
      renderUi: vi.fn(async () => Result.ok(undefined)),
      clear: vi.fn(),
      onEvent: vi.fn(() => () => undefined),
    };
    const sdk = {
      initialise: vi.fn(async () => Result.ok(undefined)),
      buildSigObj: vi.fn(),
      renderImage: vi.fn(),
      dispose: vi.fn(),
    };
    const uc = new ConnectTabletUseCase(
      tablet as never,
      sdk as never,
      config,
      new ConsoleLoggerAdapter('error'),
    );
    const r = await uc.execute();
    expect(Result.isOk(r)).toBe(true);
    expect(sdk.initialise).toHaveBeenCalledOnce();
    expect(tablet.connect).toHaveBeenCalledOnce();
    expect(tablet.renderUi).toHaveBeenCalledOnce();
  });
});
