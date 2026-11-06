'use strict';

const { Pagination } = require('./domain/Pagination');
const { SortOrder } = require('./domain/SortOrder');
const { ValidationError } = require('../../common/errors');

/**
 * Business rules for the watch later list. Storage-agnostic: atomicity of
 * dedup/limit checks is delegated to the repository.
 */
class WatchLaterService {
  /**
   * @param {object} deps
   * @param {import('./repositories/WatchLaterRepository').WatchLaterRepository} deps.repository
   * @param {{ maxSize: number, defaultPageSize: number, maxPageSize: number, defaultSortOrder: string }} deps.config
   * @param {() => Date} [deps.clock] injectable for deterministic tests
   */
  constructor({ repository, config, clock = () => new Date() }) {
    this.repository = repository;
    this.config = config;
    this.clock = clock;
  }

  async addContent(userId, contentId) {
    return this.repository.add({
      userId,
      contentId,
      addedAt: this.clock(),
      maxSize: this.config.maxSize,
    });
  }

  /** Idempotent: removing content that isn't in the list is not an error. */
  async removeContent(userId, contentId) {
    return this.repository.remove({ userId, contentId });
  }

  async listContent(userId, { pageNo = 1, pageSize, order } = {}) {
    const pagination = new Pagination({
      pageNo,
      pageSize: pageSize ?? this.config.defaultPageSize,
      maxPageSize: this.config.maxPageSize,
    });
    const sortOrder = order ?? this.config.defaultSortOrder;
    if (!SortOrder.isValid(sortOrder)) {
      throw new ValidationError(`order must be one of: ${SortOrder.values().join(', ')}`);
    }

    const { items, total } = await this.repository.list({
      userId,
      offset: pagination.offset,
      limit: pagination.limit,
      order: sortOrder,
    });
    return { items, pagination: pagination.buildMeta(total) };
  }
}

module.exports = { WatchLaterService };
