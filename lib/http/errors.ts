export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'EXTERNAL_INTEGRATION_ERROR'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', 400, message, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super('AUTHENTICATION_ERROR', 401, message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Not authorized') {
    super('AUTHORIZATION_ERROR', 403, message);
  }
}

export class ExternalIntegrationError extends AppError {
  constructor(message = 'External integration failed', details?: unknown) {
    super('EXTERNAL_INTEGRATION_ERROR', 502, message, details);
  }
}
