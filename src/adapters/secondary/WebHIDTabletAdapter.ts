import { PenPoint } from '../../domain/entities/PenPoint.js';
import {
  STU540_PRODUCT_IDS,
  TabletInfo,
  WACOM_VENDOR_ID,
} from '../../domain/entities/TabletInfo.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import {
  TabletConnectionError,
  TabletNotFoundError,
  TabletPermissionDeniedError,
  WebHidUnsupportedError,
} from '../../domain/errors/TabletConnectionError.js';
import { Result } from '../../domain/shared/Result.js';
import { LoggerPort } from '../../ports/LoggerPort.js';
import {
  TabletButton,
  TabletEvent,
  TabletEventListener,
  WacomTabletPort,
} from '../../ports/WacomTabletPort.js';
import { TabletUiConfig } from '../../ports/ConfigPort.js';
import { HID, HIDDevice, HIDInputReportEvent, NavigatorWithHid } from './webhid.types.js';

/**
 * STU-540 capabilities. Constants are sourced from the official Wacom STU
 * SDK device matrix. Coordinate ranges and pressure resolution are part of
 * the device descriptor and rarely change between firmware revisions.
 *
 * IMPORTANT: The STU-540 digitizer reports coordinates in a HIGH-RESOLUTION
 * logical space (9600 × 6000) that is independent of the 800 × 480 LCD
 * pixels. The renderer must scale from this tablet space to screen pixels.
 */
const STU540_CAPABILITIES = Object.freeze({
  screenWidthPx: 800,
  screenHeightPx: 480,
  tabletWidth: 9600,  // logical tablet coordinate range (not LCD pixels)
  tabletHeight: 6000, // logical tablet coordinate range (not LCD pixels)
  maxPressure: 1023,
  maxReportRateHz: 200,
  hasColorScreen: true,
});

/**
 * STU-540 HID report IDs (per Wacom STU SDK protocol reference).
 *
 * In standard HID mode the STU-540 uses OUTPUT reports (sendReport) for
 * host→device commands — NOT feature reports. Using sendFeatureReport for
 * these commands causes a DOMException on Chrome/Edge.
 *
 * Pen-data report ID can vary by firmware:
 *   0x01 – most firmware revisions in standard HID mode
 *   0x07 – some STU-300/430/430V firmware; not expected on STU-540
 */
const REPORT = Object.freeze({
  PEN_DATA: 0x01,
  BUTTON_DATA: 0x02,
  CLEAR_SCREEN: 0x20,
  WRITE_IMAGE: 0x21,
  SET_INKING_MODE: 0x22,
});

interface PenReport {
  pressed: boolean;
  x: number;
  y: number;
  pressure: number;
}

export class WebHIDTabletAdapter implements WacomTabletPort {
  private device?: HIDDevice;
  private info?: TabletInfo;
  private readonly listeners = new Set<TabletEventListener>();
  private inputHandler?: (event: HIDInputReportEvent) => void;
  private disconnectHandler?: (event: { device: HIDDevice }) => void;

  constructor(private readonly logger: LoggerPort) {}

  isSupported(): boolean {
    const nav = globalThis.navigator as NavigatorWithHid | undefined;
    return !!nav?.hid;
  }

  isConnected(): boolean {
    return !!this.device?.opened;
  }

  async connect(): Promise<Result<TabletInfo, DomainError>> {
    if (this.isConnected() && this.info) return Result.ok(this.info);

    const nav = globalThis.navigator as NavigatorWithHid | undefined;
    if (!nav?.hid) {
      return Result.fail(
        new WebHidUnsupportedError(
          'navigator.hid is undefined. WebHID is only available in secure ' +
            'contexts (HTTPS) on Chromium-based browsers >= 89.',
        ),
      );
    }

    const hid = nav.hid;
    let device: HIDDevice | undefined;
    try {
      // Try previously-granted devices first to avoid the picker prompt
      // every time.
      const granted = await hid.getDevices();
      device = granted.find(
        (d) =>
          d.vendorId === WACOM_VENDOR_ID && STU540_PRODUCT_IDS.includes(d.productId),
      );

      if (!device) {
        const filters = STU540_PRODUCT_IDS.map((productId) => ({
          vendorId: WACOM_VENDOR_ID,
          productId,
        }));
        const picked = await hid.requestDevice({ filters });
        device = picked[0];
      }
    } catch (err) {
      // The user dismissed the picker / DOMException("NotAllowedError").
      return Result.fail(
        new TabletPermissionDeniedError(
          'Permission to access the Wacom STU-540 was denied',
          err,
        ),
      );
    }

    if (!device) {
      return Result.fail(
        new TabletNotFoundError(
          'No Wacom STU-540 device was selected. Ensure it is plugged in and ' +
            'that the user grants access through the WebHID picker.',
        ),
      );
    }

    try {
      if (!device.opened) {
        await device.open();
      }
    } catch (err) {
      return Result.fail(
        new TabletConnectionError('Failed to open Wacom STU-540 HID device', err),
      );
    }

    this.device = device;
    this.info = TabletInfo.create({
      id: `${WACOM_VENDOR_ID}:${device.productId}`,
      model: device.productName || 'STU-540',
      firmwareVersion: 'unknown',
      capabilities: STU540_CAPABILITIES,
    });

    this.attachListeners(hid, device);
    this.logger.info('WebHID: STU-540 opened', {
      vendor: WACOM_VENDOR_ID,
      product: device.productId,
    });

    return Result.ok(this.info);
  }

  async disconnect(): Promise<Result<void, DomainError>> {
    const nav = globalThis.navigator as NavigatorWithHid | undefined;
    if (this.device && this.inputHandler) {
      this.device.removeEventListener('inputreport', this.inputHandler);
    }
    if (nav?.hid && this.disconnectHandler) {
      nav.hid.removeEventListener('disconnect', this.disconnectHandler);
    }
    try {
      if (this.device?.opened) {
        await this.device.close();
      }
    } catch (err) {
      this.logger.warn('Error closing HID device', { error: String(err) });
    }
    this.device = undefined;
    this.info = undefined;
    this.inputHandler = undefined;
    this.disconnectHandler = undefined;
    return Result.ok(undefined);
  }

  async renderUi(ui: TabletUiConfig): Promise<Result<void, DomainError>> {
    if (!this.device) {
      return Result.fail(new TabletConnectionError('Tablet not connected'));
    }
    try {
      // Set inking mode ON via an OUTPUT report (sendReport, not sendFeatureReport).
      // The STU-540 uses output reports for host→device commands in HID mode.
      await this.device.sendReport(REPORT.SET_INKING_MODE, new Uint8Array([0x01]));

      if (ui.backgroundImageBase64) {
        this.logger.debug('renderUi: background image push delegated to SDK');
      }
      return Result.ok(undefined);
    } catch (err) {
      // Non-fatal: the tablet still sends pen data even without inking-mode
      // confirmation. Log and continue so the capture session is not aborted.
      this.logger.warn('renderUi: SET_INKING_MODE output report failed (non-fatal)', {
        error: String(err),
      });
      return Result.ok(undefined);
    }
  }

  async clear(): Promise<Result<void, DomainError>> {
    if (!this.device) {
      return Result.fail(new TabletConnectionError('Tablet not connected'));
    }
    try {
      await this.device.sendReport(REPORT.CLEAR_SCREEN, new Uint8Array([0x00]));
      return Result.ok(undefined);
    } catch (err) {
      this.logger.warn('clear: CLEAR_SCREEN output report failed', { error: String(err) });
      return Result.ok(undefined);
    }
  }

  onEvent(listener: TabletEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private attachListeners(hid: HID, device: HIDDevice): void {
    this.inputHandler = (event: HIDInputReportEvent) => {
      try {
        switch (event.reportId) {
          case REPORT.PEN_DATA: {
            const parsed = this.parsePenReport(event.data);
            const point = PenPoint.create({
              x: parsed.x,
              y: parsed.y,
              pressure: parsed.pressure,
              maxPressure: STU540_CAPABILITIES.maxPressure,
            });
            this.logger.debug('WebHID pen event', {
              x: parsed.x, y: parsed.y, pressure: parsed.pressure, pressed: parsed.pressed,
            });
            this.emit({ type: 'pen', penPoint: point });
            break;
          }
          case REPORT.BUTTON_DATA: {
            const button = this.parseButtonReport(event.data);
            if (button) this.emit({ type: 'button', button });
            break;
          }
          default: {
            // Log ALL unknown report IDs with their raw bytes so we can
            // identify the real pen-data report ID if 0x01 is wrong for
            // this firmware revision.
            const bytes: number[] = [];
            for (let i = 0; i < Math.min(event.data.byteLength, 8); i++) {
              bytes.push(event.data.getUint8(i));
            }
            this.logger.debug('WebHID unknown reportId', {
              reportId: `0x${event.reportId.toString(16).padStart(2, '0')}`,
              bytes: bytes.map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
            });
            break;
          }
        }
      } catch (err) {
        this.logger.warn('Error parsing input report', {
          reportId: event.reportId,
          error: String(err),
        });
      }
    };

    this.disconnectHandler = (e) => {
      if (e.device === device) {
        this.emit({
          type: 'disconnected',
          error: new TabletConnectionError('Tablet was physically unplugged'),
        });
      }
    };

    device.addEventListener('inputreport', this.inputHandler);
    hid.addEventListener('disconnect', this.disconnectHandler);
    this.emit({ type: 'connected', info: this.info });
  }

  /**
   * Parses the STU-540 pen report.
   *
   * Byte layout confirmed from Wacom STU SDK `decodePenData` source:
   *   byte 0 bits[7]   = rdy  (pen in reporting range)
   *   byte 0 bits[6:4] = sw   (switch flags; bit 0 of sw = nib/tip pressed)
   *   byte 0 bits[3:0] = pressure[11:8] (high nibble of 12-bit pressure)
   *   byte 1           = pressure[7:0]  (low byte of 12-bit pressure)
   *   bytes 2–3        = X  (big-endian unsigned 16-bit, range 0–9600)
   *   bytes 4–5        = Y  (big-endian unsigned 16-bit, range 0–6000)
   */
  private parsePenReport(view: DataView): PenReport {
    const byte0 = view.getUint8(0);
    const byte1 = view.getUint8(1);
    const pressure = ((byte0 & 0x0f) << 8) | byte1;
    const x = view.getUint16(2, false); // big-endian
    const y = view.getUint16(4, false); // big-endian
    const sw = (byte0 >> 4) & 0x07;    // bits 6:4 of byte 0
    return {
      pressed: (sw & 0x01) === 0x01,   // bit 0 of sw = nib switch
      pressure,
      x,
      y,
    };
  }

  private parseButtonReport(view: DataView): TabletButton | undefined {
    // STU buttons report a 1-byte index of the pressed soft button.
    const idx = view.getUint8(0);
    switch (idx) {
      case 1:
        return 'clear';
      case 2:
        return 'cancel';
      case 3:
        return 'ok';
      default:
        return undefined;
    }
  }

  private emit(event: TabletEvent): void {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch (err) {
        this.logger.warn('Tablet event listener threw', { error: String(err) });
      }
    }
  }
}
