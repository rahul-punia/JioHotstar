'use strict';

const { WatchLaterRepository } = require('./WatchLaterRepository');
const { SortOrder } = require('../domain/SortOrder');
const { DuplicateContentError, WatchlistLimitError } = require('../../../common/errors');

const ITEMS_COLLECTION = 'watch_later_items';
const COUNTERS_COLLECTION = 'watch_later_counters';
const DUPLICATE_KEY_ERROR = 11000;

const TRANSACTION_OPTIONS = Object.freeze({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  readPreference: 'primary',
});

/**
 * MongoDB storage. One document per (userId, contentId) plus a per-user counter
 * document. Both collections are sharded on hashed `userId`, so every transaction
 * touches a single shard.
 *
 *   watch_later_items:    { _id, userId, contentId, addedAt }
 *   watch_later_counters: { _id: userId, count }
 */
class MongoWatchLaterRepository extends WatchLaterRepository {
  /** @param {{ client: import('mongodb').MongoClient, db: import('mongodb').Db }} deps */
  constructor({ client, db }) {
    super();
    this.client = client;
    this.items = db.collection(ITEMS_COLLECTION);
    this.counters = db.collection(COUNTERS_COLLECTION);
  }

  /** Idempotent; call once at startup. */
  async ensureIndexes() {
    await this.items.createIndexes([
      // Duplicate prevention + delete lookup.
      { key: { userId: 1, contentId: 1 }, name: 'uniq_user_content', unique: true },
      // Ordered pagination; `_id` breaks ties between equal timestamps. Usable in both directions.
      { key: { userId: 1, addedAt: -1, _id: -1 }, name: 'user_addedAt' },
    ]);
  }

  async add({ userId, contentId, addedAt, maxSize }) {
    await this.#inTransaction(async (session) => {
      try {
        await this.items.insertOne({ userId, contentId, addedAt }, { session });
      } catch (err) {
        if (err.code === DUPLICATE_KEY_ERROR) {
          throw new DuplicateContentError(contentId);
        }
        throw err;
      }

      await this.counters.updateOne(
        { _id: userId },
        { $setOnInsert: { count: 0 } },
        { upsert: true, session },
      );
      const { modifiedCount } = await this.counters.updateOne(
        { _id: userId, count: { $lt: maxSize } },
        { $inc: { count: 1 } },
        { session },
      );
      if (modifiedCount === 0) {
        // Aborts the transaction, rolling back the item insert.
        throw new WatchlistLimitError(maxSize);
      }
    });
    return { contentId, addedAt };
  }

  async remove({ userId, contentId }) {
    let removed = false;
    await this.#inTransaction(async (session) => {
      const { deletedCount } = await this.items.deleteOne({ userId, contentId }, { session });
      removed = deletedCount > 0;
      if (removed) {
        await this.counters.updateOne(
          { _id: userId, count: { $gt: 0 } },
          { $inc: { count: -1 } },
          { session },
        );
      }
    });
    return removed;
  }

  async list({ userId, offset, limit, order }) {
    const direction = SortOrder.toDirection(order);
    const [items, counter] = await Promise.all([
      this.items
        .find({ userId }, { projection: { _id: 0, contentId: 1, addedAt: 1 } })
        .sort({ addedAt: direction, _id: direction })
        .skip(offset)
        .limit(limit)
        .toArray(),
      this.counters.findOne({ _id: userId }),
    ]);
    return { items, total: counter?.count ?? 0 };
  }

  /** Runs `work` in a transaction; transient errors (e.g. write conflicts) are retried by the driver. */
  async #inTransaction(work) {
    const session = this.client.startSession();
    try {
      await session.withTransaction(work, TRANSACTION_OPTIONS);
    } finally {
      await session.endSession();
    }
  }
}

module.exports = { MongoWatchLaterRepository, ITEMS_COLLECTION, COUNTERS_COLLECTION };
