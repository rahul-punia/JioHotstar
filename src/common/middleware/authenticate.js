'use strict';

const { UnauthorizedError } = require('../errors');

const BEARER_PREFIX = 'Bearer ';

/** Resolves `req.user.id` from the bearer token; the user id is never taken from the request body. */
function createAuthenticate(tokenVerifier) {
  return function authenticate(req, res, next) {
    const header = req.get('authorization');
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      return next(new UnauthorizedError());
    }
    try {
      req.user = { id: tokenVerifier.verify(header.slice(BEARER_PREFIX.length).trim()) };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { createAuthenticate };
