'use strict';

const Joi = require('joi');
const { SortOrder } = require('./domain/SortOrder');

const contentId = Joi.string()
  .trim()
  .min(1)
  .max(64)
  .pattern(/^[A-Za-z0-9_-]+$/)
  .required();

/** Schemas depend on runtime config (page size limits, default order), hence the factory. */
function buildWatchLaterSchemas({ maxSize, defaultPageSize, maxPageSize, defaultSortOrder }) {
  return {
    add: Joi.object({ contentId }),
    remove: Joi.object({ contentId }),
    list: Joi.object({
      // A page past the max list size can never hold items, so cap it to bound `skip`.
      pageNo: Joi.number().integer().min(1).max(maxSize).default(1),
      pageSize: Joi.number().integer().min(1).max(maxPageSize).default(defaultPageSize),
      order: Joi.string()
        .lowercase()
        .valid(...SortOrder.values())
        .default(defaultSortOrder),
    }),
  };
}

module.exports = { buildWatchLaterSchemas };
