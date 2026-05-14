import { SignatureCaptureResult } from '../../domain/entities/SignatureCaptureResult.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import { Result } from '../../domain/shared/Result.js';
import { SignatureRepositoryPort } from '../../ports/SignatureRepositoryPort.js';

/**
 * Volatile, in-memory repository. Useful for unit tests and as the default
 * binding when no persistent store is required (e.g. when the consumer is
 * a Power Automate flow that uploads the SigObj on its own).
 */
export class InMemorySignatureRepository implements SignatureRepositoryPort {
  private readonly store = new Map<string, SignatureCaptureResult>();

  async save(result: SignatureCaptureResult): Promise<Result<string, DomainError>> {
    const id = this.uuid();
    this.store.set(id, result);
    return Result.ok(id);
  }

  async findById(id: string): Promise<Result<SignatureCaptureResult | null, DomainError>> {
    return Result.ok(this.store.get(id) ?? null);
  }

  private uuid(): string {
    const gCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (typeof gCrypto?.randomUUID === 'function') {
      return gCrypto.randomUUID();
    }
    return `sig-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}
