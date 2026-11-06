'use strict';

const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { describeWatchLaterRepositoryContract } = require('../contract/watchLaterRepository.contract');
const { connectMongo } = require('../../src/db/mongo');
const {
  MongoWatchLaterRepository,
  ITEMS_COLLECTION,
  COUNTERS_COLLECTION,
} = require('../../src/modules/watchLater/repositories/MongoWatchLaterRepository');

// Transactions require a replica set, so a single-node replica set is used rather than a standalone server.
let replSet;
let client;
let db;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  ({ client, db } = await connectMongo({ uri: replSet.getUri(), dbName: 'watch_later_test' }));
});

afterAll(async () => {
  await client?.close();
  await replSet?.stop();
});

async function createRepository() {
  await db.dropDatabase();
  const repo = new MongoWatchLaterRepository({ client, db });
  await repo.ensureIndexes();
  return repo;
}

describeWatchLaterRepositoryContract('MongoWatchLaterRepository', createRepository);

describe('MongoWatchLaterRepository storage details', () => {
  let repo;

  beforeEach(async () => {
    repo = await createRepository();
  });

  test('creates the dedup and pagination indexes', async () => {
    const indexes = await db.collection(ITEMS_COLLECTION).indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'uniq_user_content', unique: true, key: { userId: 1, contentId: 1 } }),
        expect.objectContaining({ name: 'user_addedAt', key: { userId: 1, addedAt: -1, _id: -1 } }),
      ]),
    );
  });

  test('ensureIndexes is idempotent', async () => {
    await expect(repo.ensureIndexes()).resolves.toBeUndefined();
  });

  test('keeps the per-user counter in sync with the items', async () => {
    const counter = () => db.collection(COUNTERS_COLLECTION).findOne({ _id: 'u1' });
    await repo.add({ userId: 'u1', contentId: 'c1', addedAt: new Date(), maxSize: 1 });
    expect((await counter()).count).toBe(1);

    await expect(
      repo.add({ userId: 'u1', contentId: 'c2', addedAt: new Date(), maxSize: 1 }),
    ).rejects.toThrow();
    // The rejected add was rolled back: no orphan item, counter unchanged.
    expect(await db.collection(ITEMS_COLLECTION).countDocuments({ userId: 'u1' })).toBe(1);
    expect((await counter()).count).toBe(1);

    await repo.remove({ userId: 'u1', contentId: 'c1' });
    expect((await counter()).count).toBe(0);
  });

  test('rethrows unexpected database errors from add', async () => {
    const failure = Object.assign(new Error('disk full'), { code: 12345 });
    jest.spyOn(repo.items, 'insertOne').mockRejectedValueOnce(failure);
    await expect(
      repo.add({ userId: 'u1', contentId: 'c1', addedAt: new Date(), maxSize: 10 }),
    ).rejects.toBe(failure);
  });
});
