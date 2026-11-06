'use strict';

const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../errors');

/**
 * Verifies HS256 access tokens and resolves the Jio user id from the `sub` claim.
 * Any object exposing `verify(token) => userId` can replace this (e.g. an RS256/JWKS
 * verifier or a call to the identity service).
 */
class JwtTokenVerifier {
  constructor({ secret }) {
    this.secret = secret;
  }

  verify(token) {
    let claims;
    try {
      claims = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
    if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
      throw new UnauthorizedError('Token has no subject');
    }
    return claims.sub;
  }
}

module.exports = { JwtTokenVerifier };
