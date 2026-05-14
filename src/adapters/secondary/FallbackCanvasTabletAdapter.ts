import { PenPoint } from '../../domain/entities/PenPoint.js';
import { TabletInfo } from '../../domain/entities/TabletInfo.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import { TabletConnectionError } from '../../domain/errors/TabletConnectionError.js';
import { Result } from '../../domain/shared/Result.js';
import { TabletUiConfig } from '../../ports/ConfigPort.js';
import { LoggerPort } from '../../ports/LoggerPort.js';
import {
  TabletEvent,
  TabletEventListener,
  WacomTabletPort,
} from '../../ports/WacomTabletPort.js';

const FALLBACK_CAPABILITIES = Object.freeze({
  screenWidthPx: 800,
  screenHeightPx: 480,
  tabletWidth: 800,
  tabletHeight: 480,
  maxPressure: 1,
  maxReportRateHz: 60,
  hasColorScreen: false,
});

/**
 * Drop-in adapter used when WebHID is unavailable or no physical tablet is
 * connected (kiosk previews, designers iterating in Power Apps, etc.). It
 * accepts mouse/touch input on a host canvas and reports it through the
 * same WacomTabletPort interface, so use cases are entirely unaware.
 */
export class FallbackCanvasTabletAdapter implements WacomTabletPort {
  private readonly listeners = new Set<TabletEventListener>();
  private canvas?: HTMLCanvasElement;
  private connected = false;
  private buttonsContainer?: HTMLElement;
  private boundPointerDown?: (e: PointerEvent) => void;
  private boundPointerMove?: (e: PointerEvent) => void;
  private boundPointerUp?: (e: PointerEvent) => void;
  private isPointerDown = false;

  constructor(private readonly logger: LoggerPort) {}

  bindToCanvas(canvas: HTMLCanvasElement, buttonsContainer?: HTMLElement): void {
    this.canvas = canvas;
    this.buttonsContainer = buttonsContainer;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && !!this.canvas;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<Result<TabletInfo, DomainError>> {
    if (!this.canvas) {
      return Result.fail(
        new TabletConnectionError(
          'FallbackCanvasTabletAdapter has no canvas bound. Call bindToCanvas() first.',
        ),
      );
    }
    this.installPointerListeners();
    this.installSoftButtons();
    this.connected = true;
    const info = TabletInfo.create({
      id: 'fallback-canvas',
      model: 'Canvas Fallback',
      firmwareVersion: 'n/a',
      capabilities: FALLBACK_CAPABILITIES,
    });
    this.emit({ type: 'connected', info });
    return Result.ok(info);
  }

  async disconnect(): Promise<Result<void, DomainError>> {
    this.removePointerListeners();
    this.removeSoftButtons();
    this.connected = false;
    this.emit({ type: 'disconnected' });
    return Result.ok(undefined);
  }

  async renderUi(_ui: TabletUiConfig): Promise<Result<void, DomainError>> {
    // No-op: the host page is responsible for rendering its own UI.
    return Result.ok(undefined);
  }

  async clear(): Promise<Result<void, DomainError>> {
    if (!this.canvas) return Result.ok(undefined);
    const ctx = this.canvas.getContext('2d');
    ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    return Result.ok(undefined);
  }

  onEvent(listener: TabletEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private installPointerListeners(): void {
    if (!this.canvas) return;
    const canvas = this.canvas;
    const toTabletSpace = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * FALLBACK_CAPABILITIES.tabletWidth;
      const y = ((e.clientY - rect.top) / rect.height) * FALLBACK_CAPABILITIES.tabletHeight;
      return { x, y };
    };

    this.boundPointerDown = (e) => {
      this.isPointerDown = true;
      const { x, y } = toTabletSpace(e);
      this.emit({
        type: 'pen',
        penPoint: PenPoint.create({ x, y, pressure: 1, maxPressure: 1 }),
      });
    };
    this.boundPointerMove = (e) => {
      if (!this.isPointerDown) return;
      const { x, y } = toTabletSpace(e);
      // PointerEvent pressure is 0..1 on supported devices; default is 0.5.
      const pressure = Number.isFinite(e.pressure) && e.pressure > 0 ? e.pressure : 1;
      this.emit({
        type: 'pen',
        penPoint: PenPoint.create({ x, y, pressure, maxPressure: 1 }),
      });
    };
    this.boundPointerUp = (e) => {
      this.isPointerDown = false;
      const { x, y } = toTabletSpace(e);
      this.emit({
        type: 'pen',
        penPoint: PenPoint.create({ x, y, pressure: 0, maxPressure: 1 }),
      });
    };

    canvas.addEventListener('pointerdown', this.boundPointerDown);
    canvas.addEventListener('pointermove', this.boundPointerMove);
    canvas.addEventListener('pointerup', this.boundPointerUp);
    canvas.addEventListener('pointercancel', this.boundPointerUp);
  }

  private removePointerListeners(): void {
    if (!this.canvas) return;
    if (this.boundPointerDown)
      this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    if (this.boundPointerMove)
      this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    if (this.boundPointerUp) {
      this.canvas.removeEventListener('pointerup', this.boundPointerUp);
      this.canvas.removeEventListener('pointercancel', this.boundPointerUp);
    }
  }

  private installSoftButtons(): void {
    if (!this.buttonsContainer) return;
    const make = (label: string, button: 'clear' | 'cancel' | 'ok') => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.dataset.action = button;
      btn.addEventListener('click', () => this.emit({ type: 'button', button }));
      return btn;
    };
    this.buttonsContainer.innerHTML = '';
    this.buttonsContainer.appendChild(make('Clear', 'clear'));
    this.buttonsContainer.appendChild(make('Cancel', 'cancel'));
    this.buttonsContainer.appendChild(make('OK', 'ok'));
  }

  private removeSoftButtons(): void {
    if (this.buttonsContainer) this.buttonsContainer.innerHTML = '';
  }

  private emit(event: TabletEvent): void {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch (err) {
        this.logger.warn('Fallback event listener threw', { error: String(err) });
      }
    }
  }
}
