/**
 * Base class for every error raised inside the domain or application layer.
 * Carries a stable error code so primary adapters (Power Apps, PCF, REST)
 * can map errors to user-facing messages without inspecting `.message`.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    if (typeof (Error as { captureStackTrace?: unknown }).captureStackTrace === 'function') {
      (Error as unknown as { captureStackTrace(target: object, fn?: unknown): void })
        .captureStackTrace(this, this.constructor);
    }
  }
}
