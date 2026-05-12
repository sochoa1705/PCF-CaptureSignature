import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CaptureSignatureUseCase } from '../../src/application/use-cases/CaptureSignatureUseCase';
import { PenPoint } from '../../src/domain/entities/PenPoint';
import { TabletInfo } from '../../src/domain/entities/TabletInfo';
import { Result } from '../../src/domain/shared/Result';
import { SignatureCancelledError, SignatureEmptyError } from '../../src/domain/errors/SignatureCaptureError';
import { ConsoleLoggerAdapter } from '../../src/adapters/secondary/ConsoleLoggerAdapter';
import { StaticConfigAdapter, buildConfig } from '../../src/infrastructure/config/WacomConfig';
import { TabletEventListener } from '../../src/ports/WacomTabletPort';

const tabletInfo = TabletInfo.create({
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

const config = new StaticConfigAdapter(
  buildConfig({
    license: { licenseString: 'TEST' },
    overrides: { captureTimeoutMs: 200 },
  }),
);

interface MockTablet {
  isConnected: () => boolean;
  clear: () => Promise<Result<void, never>>;
  onEvent: (l: TabletEventListener) => () => void;
  emit: (e: Parameters<TabletEventListener>[0]) => void;
}

function makeMocks() {
  const listeners = new Set<TabletEventListener>();
  const tablet: MockTablet = {
    isConnected: () => true,
    clear: vi.fn(async () => Result.ok(undefined)),
    onEvent: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    emit: (e) => listeners.forEach((l) => l(e)),
  };
  const sdk = {
    initialise: vi.fn(),
    buildSigObj: vi.fn(async (params: { points: PenPoint[]; metadata: unknown; width: number; height: number }) =>
      Result.ok({
        signature: {
          points: params.points,
          metadata: params.metadata,
          width: params.width,
          height: params.height,
        } as never,
        sigObjBase64: 'BASE64-FAKE',
      }),
    ),
    renderImage: vi.fn(async () =>
      Result.ok({ format: 'png' as const, base64: 'IMG', widthPx: 100, heightPx: 100 }),
    ),
    dispose: vi.fn(),
  };
  const renderer = {
    attach: vi.fn(),
    detach: vi.fn(),
    drawPenPoint: vi.fn(() => Result.ok(undefined)),
    clear: vi.fn(),
    toBase64Png: vi.fn(() => ''),
  };
  return { tablet, sdk, renderer, listeners };
}

describe('CaptureSignatureUseCase', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves with a SignatureCaptureResult when the user presses OK', async () => {
    const { tablet, sdk, renderer } = makeMocks();
    const uc = new CaptureSignatureUseCase(
      tablet as never,
      sdk as never,
      renderer as never,
      config,
      new ConsoleLoggerAdapter('error'),
    );

    const promise = uc.execute(
      { signerName: 'Test', reason: 'Demo' },
      tabletInfo,
    );

    // Emit a couple of pen samples + OK button asynchronously.
    queueMicrotask(() => {
      tablet.emit({ type: 'pen', penPoint: PenPoint.create({ x: 10, y: 10, pressure: 1, maxPressure: 1 }) });
      tablet.emit({ type: 'pen', penPoint: PenPoint.create({ x: 20, y: 20, pressure: 1, maxPressure: 1 }) });
      tablet.emit({ type: 'button', button: 'ok' });
    });
    await vi.runAllTimersAsync();

    const r = await promise;
    expect(Result.isOk(r)).toBe(true);
    expect(sdk.buildSigObj).toHaveBeenCalledOnce();
    expect(sdk.renderImage).toHaveBeenCalledOnce();
  });

  it('rejects with SignatureEmptyError when OK is pressed without any ink', async () => {
    const { tablet, sdk, renderer } = makeMocks();
    const uc = new CaptureSignatureUseCase(
      tablet as never,
      sdk as never,
      renderer as never,
      config,
      new ConsoleLoggerAdapter('error'),
    );
    const promise = uc.execute(
      { signerName: 'Test', reason: 'Demo' },
      tabletInfo,
    );
    queueMicrotask(() => tablet.emit({ type: 'button', button: 'ok' }));
    await vi.runAllTimersAsync();
    const r = await promise;
    expect(Result.isFail(r) && r.error).toBeInstanceOf(SignatureEmptyError);
  });

  it('rejects with SignatureCancelledError when Cancel is pressed', async () => {
    const { tablet, sdk, renderer } = makeMocks();
    const uc = new CaptureSignatureUseCase(
      tablet as never,
      sdk as never,
      renderer as never,
      config,
      new ConsoleLoggerAdapter('error'),
    );
    const promise = uc.execute(
      { signerName: 'Test', reason: 'Demo' },
      tabletInfo,
    );
    queueMicrotask(() => tablet.emit({ type: 'button', button: 'cancel' }));
    await vi.runAllTimersAsync();
    const r = await promise;
    expect(Result.isFail(r) && r.error).toBeInstanceOf(SignatureCancelledError);
  });
});
