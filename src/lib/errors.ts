export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly details: Record<string, unknown>,
    public readonly retryable = false,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ConfigError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('CONFIG_INVALID', details, false, message);
    this.name = 'ConfigError';
  }
}

export class BrowserError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}, retryable = true) {
    super('BROWSER_FAILURE', details, retryable, message);
    this.name = 'BrowserError';
  }
}

export class ModuleError extends AppError {
  constructor(moduleName: string, message: string, details: Record<string, unknown> = {}) {
    super('MODULE_FAILURE', { moduleName, ...details }, true, message);
    this.name = 'ModuleError';
  }
}

export class AuthError extends AppError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('AUTH_FAILURE', details, true, message);
    this.name = 'AuthError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
