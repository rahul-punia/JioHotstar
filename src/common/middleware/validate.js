'use strict';

const { ValidationError } = require('../errors');

const SOURCES = ['params', 'query', 'body'];

/**
 * Validates request parts against Joi schemas and exposes the coerced values on
 * `req.validated` (so handlers get numbers/defaults rather than raw strings).
 *
 * @param {{ params?: import('joi').Schema, query?: import('joi').Schema, body?: import('joi').Schema }} schemas
 */
function validate(schemas) {
  return function validateRequest(req, res, next) {
    const validated = {};
    for (const source of SOURCES) {
      const schema = schemas[source];
      if (!schema) continue;

      const { error, value } = schema.validate(req[source] ?? {}, {
        abortEarly: false,
        convert: true,
        stripUnknown: true,
      });
      if (error) {
        const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
        return next(new ValidationError('Request validation failed', details));
      }
      validated[source] = value;
    }
    req.validated = validated;
    return next();
  };
}

module.exports = { validate };
