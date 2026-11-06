'use strict';

/** Express 4 doesn't forward rejected promises to error middleware; this does. */
function asyncHandler(handler) {
  return function asyncRoute(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
