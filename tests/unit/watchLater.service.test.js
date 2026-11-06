'use strict';

const { WatchLaterService } = require('../../src/modules/watchLater/watchLater.service');
const {
  InMemoryWatchLaterRepository,
} = require('../../src/modules/watchLater/repositories/InMemoryWatchLaterRepository');
const {
  DuplicateContentError,
  WatchlistLimitError,
  ValidationError,
} = require('../../src/common/errors');

const baseConfig = { maxSize: 3, defaultPageSize: 2, maxPageSize: 5, defaultSortOrder: 'desc' };

function buildService(config = {}) {
  let tick = 0;
  // Deterministic clock: each call is one second after the previous one.
  const clock = () => new Date(Date.UTC(2026, 0, 1) + 1000 * tick++);
  const repository = new InMemoryWatchLaterRepository();
  const service = new WatchLaterService({ repository, config: { ...baseConfig, ...config }, clock });
  return { service, repository };
}

describe('WatchLaterService', () => {
  const userId = 'user-1';

  describe('addContent', () => {
    test('stores content with a server-generated addedAt', async () => {
      const { service } = buildService();
      await expect(service.addContent(userId, 'c1')).resolves.toEqual({
        contentId: 'c1',
        addedAt: new Date(Date.UTC(2026, 0, 1)),
      });
    });

    test('passes the configured max size to the repository', async () => {
      const { service, repository } = buildService({ maxSize: 7 });
      const spy = jest.spyOn(repository, 'add');
      await service.addContent(userId, 'c1');
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ userId, contentId: 'c1', maxSize: 7 }));
    });

    test('rejects duplicates', async () => {
      const { service } = buildService();
      await service.addContent(userId, 'c1');
      await expect(service.addContent(userId, 'c1')).rejects.toBeInstanceOf(DuplicateContentError);
    });

    test('rejects once the configured max size is reached', async () => {
      const { service } = buildService({ maxSize: 2 });
      await service.addContent(userId, 'c1');
      await service.addContent(userId, 'c2');
      await expect(service.addContent(userId, 'c3')).rejects.toBeInstanceOf(WatchlistLimitError);
    });
  });

  describe('removeContent', () => {
    test('removes existing content', async () => {
      const { service } = buildService();
      await service.addContent(userId, 'c1');
      await expect(service.removeContent(userId, 'c1')).resolves.toBe(true);
      const { items } = await service.listContent(userId);
      expect(items).toEqual([]);
    });

    test('is a no-op for content that is not in the list', async () => {
      const { service } = buildService();
      await expect(service.removeContent(userId, 'missing')).resolves.toBe(false);
    });
  });

  describe('listContent', () => {
    const seed = async (service, ids) => {
      for (const id of ids) await service.addContent(userId, id);
    };
    const ids = (result) => result.items.map((i) => i.contentId);

    test('uses configured defaults for page size and order', async () => {
      const { service } = buildService();
      await seed(service, ['c1', 'c2', 'c3']);
      const result = await service.listContent(userId);
      expect(ids(result)).toEqual(['c3', 'c2']);
      expect(result.pagination).toEqual({
        pageNo: 1,
        pageSize: 2,
        totalItems: 3,
        totalPages: 2,
        hasNext: true,
      });
    });

    test('honours a configured ascending default order', async () => {
      const { service } = buildService({ defaultSortOrder: 'asc' });
      await seed(service, ['c1', 'c2', 'c3']);
      expect(ids(await service.listContent(userId))).toEqual(['c1', 'c2']);
    });

    test('supports explicit order and pageNo', async () => {
      const { service } = buildService();
      await seed(service, ['c1', 'c2', 'c3']);
      const result = await service.listContent(userId, { pageNo: 2, pageSize: 2, order: 'asc' });
      expect(ids(result)).toEqual(['c3']);
      expect(result.pagination).toMatchObject({ pageNo: 2, totalPages: 2, hasNext: false });
    });

    test('returns an empty page for a user with no list', async () => {
      const { service } = buildService();
      await expect(service.listContent(userId)).resolves.toEqual({
        items: [],
        pagination: { pageNo: 1, pageSize: 2, totalItems: 0, totalPages: 0, hasNext: false },
      });
    });

    test('returns an empty page past the end', async () => {
      const { service } = buildService();
      await seed(service, ['c1']);
      const result = await service.listContent(userId, { pageNo: 3 });
      expect(result.items).toEqual([]);
      expect(result.pagination.totalItems).toBe(1);
    });

    test('rejects a page size above the configured maximum', async () => {
      const { service } = buildService();
      await expect(service.listContent(userId, { pageSize: 6 })).rejects.toBeInstanceOf(ValidationError);
    });

    test('rejects an unknown order', async () => {
      const { service } = buildService();
      await expect(service.listContent(userId, { order: 'random' })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });

  test('uses the wall clock by default', async () => {
    const service = new WatchLaterService({
      repository: new InMemoryWatchLaterRepository(),
      config: baseConfig,
    });
    const before = Date.now();
    const { addedAt } = await service.addContent('u', 'c1');
    expect(addedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(addedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
