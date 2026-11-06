'use strict';

const Joi = require('joi');
const { SortOrder } = require('../modules/watchLater/domain/SortOrder');

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  MONGO_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .default('mongodb://localhost:27017/?replicaSet=rs0'),
  MONGO_DB_NAME: Joi.string().default('jiohotstar'),
  JWT_SECRET: Joi.string().min(16).required(),
  WATCHLIST_MAX_SIZE: Joi.number().integer().min(1).default(500),
  MAX_PAGE_SIZE: Joi.number().integer().min(1).default(100),
  DEFAULT_PAGE_SIZE: Joi.number().integer().min(1).max(Joi.ref('MAX_PAGE_SIZE')).default(20),
  DEFAULT_SORT_ORDER: Joi.string()
    .lowercase()
    .valid(...SortOrder.values())
    .default(SortOrder.DESC),
}).unknown(true);

/**
 * Parses and validates configuration from the environment. Fails fast on bad values
 * so a misconfigured instance never starts serving traffic.
 */
function loadConfig(env = process.env) {
  const { error, value } = envSchema.validate(env, { abortEarly: false, convert: true });
  if (error) {
    throw new Error(`Invalid configuration: ${error.details.map((d) => d.message).join('; ')}`);
  }

  return Object.freeze({
    env: value.NODE_ENV,
    port: value.PORT,
    mongo: Object.freeze({ uri: value.MONGO_URI, dbName: value.MONGO_DB_NAME }),
    auth: Object.freeze({ jwtSecret: value.JWT_SECRET }),
    watchLater: Object.freeze({
      maxSize: value.WATCHLIST_MAX_SIZE,
      defaultPageSize: value.DEFAULT_PAGE_SIZE,
      maxPageSize: value.MAX_PAGE_SIZE,
      defaultSortOrder: value.DEFAULT_SORT_ORDER,
    }),
  });
}

module.exports = { loadConfig };
