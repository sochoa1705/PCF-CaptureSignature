/**
 * Strongly typed identifier for a tablet device. Wraps a string so the
 * compiler prevents accidentally passing arbitrary strings where a DeviceId
 * is expected.
 */
export class DeviceId {
  private constructor(public readonly value: string) {}

  static of(value: string): DeviceId {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new Error('DeviceId cannot be empty');
    }
    return new DeviceId(trimmed);
  }

  equals(other: DeviceId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
