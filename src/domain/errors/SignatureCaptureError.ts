import { DomainError } from './DomainError.js';

export class SignatureCaptureError extends DomainError {
  readonly code = 'SIGNATURE_CAPTURE_ERROR';
}

export class SignatureCancelledError extends DomainError {
  readonly code = 'SIGNATURE_CANCELLED';
}

export class SignatureEmptyError extends DomainError {
  readonly code = 'SIGNATURE_EMPTY';
}

export class SignatureRenderError extends DomainError {
  readonly code = 'SIGNATURE_RENDER_ERROR';
}
