'use strict';

/**
 * Storage contract for watch later lists. The service depends only on this contract,
 * so storage engines can be swapped (or decorated, e.g. with a cache) without touching
 * business logic.
 *
 * Implementations must make `add` atomic: duplicate detection and the max-size check
 * must hold under concurrent requests for the same user.
 *
 * @typedef {{ contentId: string, addedAt: Date }} WatchLaterItem
 */
class WatchLaterRepository {
  /**
   * @param {{ userId: string, contentId: string, addedAt: Date, maxSize: number }} params
   * @returns {Promise<WatchLaterItem>}
   * @throws {DuplicateContentError} when the content is already in the user's list
   * @throws {WatchlistLimitError} when the list already holds `maxSize` items
   */
  async add(params) {
    throw new Error(`${this.constructor.name}.add is not implemented`);
  }

  /**
   * @param {{ userId: string, contentId: string }} params
   * @returns {Promise<boolean>} whether an item was removed
   */
  async remove(params) {
    throw new Error(`${this.constructor.name}.remove is not implemented`);
  }

  /**
   * @param {{ userId: string, offset: number, limit: number, order: 'asc' | 'desc' }} params
   * @returns {Promise<{ items: WatchLaterItem[], total: number }>}
   */
  async list(params) {
    throw new Error(`${this.constructor.name}.list is not implemented`);
  }
}

module.exports = { WatchLaterRepository };
