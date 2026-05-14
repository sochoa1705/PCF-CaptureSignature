import { DeviceId } from '../value-objects/DeviceId.js';

/**
 * Wacom STU-540 USB vendor/product identifiers (per the official STU SDK
 * device matrix). The vendor id is constant across the STU range; the
 * product id varies between models.
 */
export const WACOM_VENDOR_ID = 0x056a;
export const STU540_PRODUCT_IDS: readonly number[] = Object.freeze([
  // STU-540 - serial-over-HID and pure HID variants both report under 0x00a8
  // depending on firmware. We keep the list small and explicit; extend if
  // an integrator needs to support adjacent models.
  0x00a8,
]);

export interface TabletCapabilities {
  readonly screenWidthPx: number;
  readonly screenHeightPx: number;
  readonly tabletWidth: number;
  readonly tabletHeight: number;
  readonly maxPressure: number;
  readonly maxReportRateHz: number;
  readonly hasColorScreen: boolean;
}

/**
 * Immutable description of a connected tablet. Carries enough information
 * for use cases to reason about coordinate mapping and rendering without
 * referencing concrete adapters.
 */
export class TabletInfo {
  private constructor(
    public readonly id: DeviceId,
    public readonly model: string,
    public readonly firmwareVersion: string,
    public readonly capabilities: TabletCapabilities,
  ) {}

  static create(params: {
    id: string;
    model: string;
    firmwareVersion: string;
    capabilities: TabletCapabilities;
  }): TabletInfo {
    return new TabletInfo(
      DeviceId.of(params.id),
      params.model,
      params.firmwareVersion,
      params.capabilities,
    );
  }

  isStu540(): boolean {
    return /STU-?540/i.test(this.model);
  }
}
