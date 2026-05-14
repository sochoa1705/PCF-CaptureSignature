import { SignatureCaptureResult } from '../domain/entities/SignatureCaptureResult.js';
import { Result } from '../domain/shared/Result.js';
import { DomainError } from '../domain/errors/DomainError.js';

/**
 * Persistence contract for captured signatures. Typical implementations:
 *  - InMemorySignatureRepository (default, used by the PCF/iframe path),
 *  - DataverseSignatureRepository (writes to a Dataverse table),
 *  - SharePointSignatureRepository,
 *  - HttpSignatureRepository (POSTs to a Power Automate flow).
 */
export interface SignatureRepositoryPort {
  save(result: SignatureCaptureResult): Promise<Result<string, DomainError>>;
  findById(id: string): Promise<Result<SignatureCaptureResult | null, DomainError>>;
}
