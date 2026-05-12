import { DomainError } from './DomainError.js';

export class TabletConnectionError extends DomainError {
  readonly code = 'TABLET_CONNECTION_ERROR';
}

export class TabletNotFoundError extends DomainError {
  readonly code = 'TABLET_NOT_FOUND';
}

export class WebHidUnsupportedError extends DomainError {
  readonly code = 'WEBHID_UNSUPPORTED';
}

export class TabletPermissionDeniedError extends DomainError {
  readonly code = 'TABLET_PERMISSION_DENIED';
}

export class TabletTimeoutError extends DomainError {
  readonly code = 'TABLET_TIMEOUT';
}
