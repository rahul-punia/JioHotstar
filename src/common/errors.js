'use strict';

/**
 * Base class for errors that are safe to expose to clients. The error-handling
 * middleware maps these to HTTP responses; anything else becomes a 500.
 */
class AppError extends Error {
  constructor(message, { code, status, details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { code: 'VALIDATION_ERROR', status: 400, details });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, { code: 'UNAUTHORIZED', status: 401 });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, { code: 'NOT_FOUND', status: 404 });
  }
}

class DuplicateContentError extends AppError {
  constructor(contentId) {
    super(`Content '${contentId}' is already in the watch later list`, {
      code: 'CONTENT_ALREADY_IN_WATCHLIST',
      status: 409,
    });
  }
}

class WatchlistLimitError extends AppError {
  constructor(maxSize) {
    super(`Watch later list cannot hold more than ${maxSize} items`, {
      code: 'WATCHLIST_LIMIT_REACHED',
      status: 422,
    });
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  DuplicateContentError,
  WatchlistLimitError,
};
