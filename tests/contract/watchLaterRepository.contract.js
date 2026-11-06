'use strict';

const { DuplicateContentError, WatchlistLimitError } = require('../../src/common/errors');

/**
 * Behaviour every WatchLaterRepository implementation must satisfy. Run against each
 * implementation so they stay interchangeable.
 *
 * @param {string} name
 * @param {() => Promise<import('../../src/modules/watchLater/repositories/WatchLaterRepository').WatchLaterRepository>} createRepository
 *   returns a repository with empty storage
 */
function describeWatchLaterRepositoryContract(name, createRepository) {
  describe(`${name} (WatchLaterRepository contract)`, () => {
    const userId = 'user-1';
    const at = (ms) => new Date(Date.UTC(2026, 0, 1) + ms);
    let repo;

    beforeEach(async () => {
      repo = await createRepository();
    });

    const addAll = async (contentIds, { user = userId, maxSize = 100 } = {}) => {
      for (const [i, contentId] of contentIds.entries()) {
        await repo.add({ userId: user, contentId, addedAt: at(i * 1000), maxSize });
      }
    };

    test('add returns the stored item', async () => {
      const item = await repo.add({ userId, contentId: 'c1', addedAt: at(0), maxSize: 10 });
      expect(item).toEqual({ contentId: 'c1', addedAt: at(0) });
    });

    test('add rejects duplicates for the same user', async () => {
      await addAll(['c1']);
      await expect(
        repo.add({ userId, contentId: 'c1', addedAt: at(5), maxSize: 10 }),
      ).rejects.toBeInstanceOf(DuplicateContentError);
      expect((await repo.list({ userId, offset: 0, limit: 10, order: 'desc' })).total).toBe(1);
    });

    test('the same content can be in different users\' lists', async () => {
      await addAll(['c1'], { user: 'user-a' });
      await expect(
        repo.add({ userId: 'user-b', contentId: 'c1', addedAt: at(0), maxSize: 10 }),
      ).resolves.toEqual({ contentId: 'c1', addedAt: at(0) });
    });

    test('add rejects once the list holds maxSize items', async () => {
      await addAll(['c1', 'c2'], { maxSize: 2 });
      await expect(
        repo.add({ userId, contentId: 'c3', addedAt: at(9000), maxSize: 2 }),
      ).rejects.toBeInstanceOf(WatchlistLimitError);
      expect((await repo.list({ userId, offset: 0, limit: 10, order: 'desc' })).total).toBe(2);
    });

    test('duplicate is reported before limit when the list is full', async () => {
      await addAll(['c1'], { maxSize: 1 });
      await expect(
        repo.add({ userId, contentId: 'c1', addedAt: at(5), maxSize: 1 }),
      ).rejects.toBeInstanceOf(DuplicateContentError);
    });

    test('removing frees a slot under the limit', async () => {
      await addAll(['c1', 'c2'], { maxSize: 2 });
      await repo.remove({ userId, contentId: 'c1' });
      await expect(
        repo.add({ userId, contentId: 'c3', addedAt: at(9000), maxSize: 2 }),
      ).resolves.toBeDefined();
    });

    test('remove reports whether an item was removed', async () => {
      await addAll(['c1']);
      await expect(repo.remove({ userId, contentId: 'c1' })).resolves.toBe(true);
      await expect(repo.remove({ userId, contentId: 'c1' })).resolves.toBe(false);
      await expect(repo.remove({ userId: 'nobody', contentId: 'c1' })).resolves.toBe(false);
    });

    test('removed content can be added again', async () => {
      await addAll(['c1']);
      await repo.remove({ userId, contentId: 'c1' });
      await expect(
        repo.add({ userId, contentId: 'c1', addedAt: at(5000), maxSize: 10 }),
      ).resolves.toBeDefined();
    });

    test('list of an unknown user is empty', async () => {
      await expect(
        repo.list({ userId: 'nobody', offset: 0, limit: 10, order: 'desc' }),
      ).resolves.toEqual({ items: [], total: 0 });
    });

    test('list orders by addedAt in both directions', async () => {
      await addAll(['c1', 'c2', 'c3']);
      const ids = async (order) =>
        (await repo.list({ userId, offset: 0, limit: 10, order })).items.map((i) => i.contentId);
      expect(await ids('desc')).toEqual(['c3', 'c2', 'c1']);
      expect(await ids('asc')).toEqual(['c1', 'c2', 'c3']);
    });

    test('list paginates with offset/limit and reports the total', async () => {
      await addAll(['c1', 'c2', 'c3', 'c4', 'c5']);
      const page = await repo.list({ userId, offset: 2, limit: 2, order: 'asc' });
      expect(page).toEqual({
        items: [
          { contentId: 'c3', addedAt: at(2000) },
          { contentId: 'c4', addedAt: at(3000) },
        ],
        total: 5,
      });
      const past = await repo.list({ userId, offset: 10, limit: 2, order: 'asc' });
      expect(past).toEqual({ items: [], total: 5 });
    });

    test('items with equal addedAt keep insertion order', async () => {
      for (const contentId of ['a', 'b', 'c']) {
        await repo.add({ userId, contentId, addedAt: at(0), maxSize: 10 });
      }
      const ids = async (order) =>
        (await repo.list({ userId, offset: 0, limit: 10, order })).items.map((i) => i.contentId);
      expect(await ids('asc')).toEqual(['a', 'b', 'c']);
      expect(await ids('desc')).toEqual(['c', 'b', 'a']);
    });

    test('lists are isolated per user', async () => {
      await addAll(['c1', 'c2'], { user: 'user-a' });
      await addAll(['c9'], { user: 'user-b' });
      const page = await repo.list({ userId: 'user-b', offset: 0, limit: 10, order: 'desc' });
      expect(page.items.map((i) => i.contentId)).toEqual(['c9']);
      expect(page.total).toBe(1);
    });

    test('concurrent adds never exceed maxSize', async () => {
      const maxSize = 3;
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          repo.add({ userId, contentId: `c${i}`, addedAt: at(i), maxSize }),
        ),
      );
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(maxSize);
      rejected.forEach((r) => expect(r.reason).toBeInstanceOf(WatchlistLimitError));
      expect((await repo.list({ userId, offset: 0, limit: 10, order: 'desc' })).total).toBe(maxSize);
    });

    test('concurrent adds of the same content store it once', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          repo.add({ userId, contentId: 'same', addedAt: at(0), maxSize: 10 }),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      results
        .filter((r) => r.status === 'rejected')
        .forEach((r) => expect(r.reason).toBeInstanceOf(DuplicateContentError));
      expect((await repo.list({ userId, offset: 0, limit: 10, order: 'desc' })).total).toBe(1);
    });
  });
}

module.exports = { describeWatchLaterRepositoryContract };
