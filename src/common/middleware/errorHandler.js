'use strict';

const { AppError, NotFoundError } = require('../errors');

function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
}

/** Single place that maps errors to the `{ error: { code, message } }` response shape. */
function createErrorHandler(logger) {
  // Express identifies error handlers by arity, so `next` must stay in the signature.
  return function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
      });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
    }
    logger.error('Unhandled error', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
  };
}

module.exports = { notFoundHandler, createErrorHandler };
