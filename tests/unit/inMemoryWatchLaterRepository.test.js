'use strict';

const { describeWatchLaterRepositoryContract } = require('../contract/watchLaterRepository.contract');
const {
  InMemoryWatchLaterRepository,
} = require('../../src/modules/watchLater/repositories/InMemoryWatchLaterRepository');
const { WatchLaterRepository } = require('../../src/modules/watchLater/repositories/WatchLaterRepository');

describeWatchLaterRepositoryContract('InMemoryWatchLaterRepository', async () => new InMemoryWatchLaterRepository());

describe('WatchLaterRepository base class', () => {
  test.each(['add', 'remove', 'list'])('%s must be implemented by subclasses', async (method) => {
    class Incomplete extends WatchLaterRepository {}
    await expect(new Incomplete()[method]({})).rejects.toThrow(`Incomplete.${method} is not implemented`);
  });
});
