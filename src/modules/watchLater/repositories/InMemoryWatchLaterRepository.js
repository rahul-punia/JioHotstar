'use strict';

const { WatchLaterRepository } = require('./WatchLaterRepository');
const { SortOrder } = require('../domain/SortOrder');
const { DuplicateContentError, WatchlistLimitError } = require('../../../common/errors');

/**
 * Process-local implementation for tests and local development. Each method runs
 * synchronously between awaits, so check-then-write in `add` is atomic.
 */
class InMemoryWatchLaterRepository extends WatchLaterRepository {
  constructor() {
    super();
    /** @type {Map<string, Map<string, { contentId: string, addedAt: Date, seq: number }>>} */
    this.listsByUser = new Map();
    this.seq = 0;
  }

  async add({ userId, contentId, addedAt, maxSize }) {
    const list = this.listsByUser.get(userId) ?? new Map();
    if (list.has(contentId)) {
      throw new DuplicateContentError(contentId);
    }
    if (list.size >= maxSize) {
      throw new WatchlistLimitError(maxSize);
    }
    list.set(contentId, { contentId, addedAt, seq: ++this.seq });
    this.listsByUser.set(userId, list);
    return { contentId, addedAt };
  }

  async remove({ userId, contentId }) {
    const list = this.listsByUser.get(userId);
    return list ? list.delete(contentId) : false;
  }

  async list({ userId, offset, limit, order }) {
    const list = this.listsByUser.get(userId);
    if (!list) {
      return { items: [], total: 0 };
    }
    const direction = SortOrder.toDirection(order);
    const items = [...list.values()]
      .sort((a, b) => direction * (a.addedAt - b.addedAt || a.seq - b.seq))
      .slice(offset, offset + limit)
      .map(({ contentId, addedAt }) => ({ contentId, addedAt }));
    return { items, total: list.size };
  }
}

module.exports = { InMemoryWatchLaterRepository };
