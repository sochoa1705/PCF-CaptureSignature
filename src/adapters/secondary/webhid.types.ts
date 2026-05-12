/**
 * Minimal subset of the WebHID DOM types we rely on. TypeScript's lib.dom
 * ships these only behind --target ESNext + `lib: ["DOM"]` and the WebHID
 * declarations are sometimes absent depending on the consumer's setup.
 * Re-declaring them here keeps the connector self-contained.
 */

export interface HIDDevice {
  readonly opened: boolean;
  readonly productId: number;
  readonly vendorId: number;
  readonly productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  sendFeatureReport(reportId: number, data: BufferSource): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<DataView>;
  addEventListener(
    type: 'inputreport',
    listener: (event: HIDInputReportEvent) => void,
  ): void;
  removeEventListener(
    type: 'inputreport',
    listener: (event: HIDInputReportEvent) => void,
  ): void;
}

export interface HIDInputReportEvent extends Event {
  readonly device: HIDDevice;
  readonly reportId: number;
  readonly data: DataView;
}

export interface HIDDeviceRequestOptions {
  filters: Array<{ vendorId?: number; productId?: number }>;
}

export interface HID {
  requestDevice(options: HIDDeviceRequestOptions): Promise<HIDDevice[]>;
  getDevices(): Promise<HIDDevice[]>;
  addEventListener(
    type: 'connect' | 'disconnect',
    listener: (event: { device: HIDDevice }) => void,
  ): void;
  removeEventListener(
    type: 'connect' | 'disconnect',
    listener: (event: { device: HIDDevice }) => void,
  ): void;
}

export interface NavigatorWithHid extends Navigator {
  readonly hid?: HID;
}
