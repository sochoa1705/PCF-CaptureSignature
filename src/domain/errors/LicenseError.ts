import { DomainError } from './DomainError.js';

export class LicenseError extends DomainError {
  readonly code = 'WACOM_LICENSE_ERROR';
}

export class LicenseMissingError extends DomainError {
  readonly code = 'WACOM_LICENSE_MISSING';
}

export class LicenseExpiredError extends DomainError {
  readonly code = 'WACOM_LICENSE_EXPIRED';
}
