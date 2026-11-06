'use strict';

const { loadConfig } = require('../../src/config');

const SECRET = 'a-very-long-test-secret';

describe('loadConfig', () => {
  test('applies defaults', () => {
    expect(loadConfig({ JWT_SECRET: SECRET })).toEqual({
      env: 'development',
      port: 3000,
      mongo: { uri: 'mongodb://localhost:27017/?replicaSet=rs0', dbName: 'jiohotstar' },
      auth: { jwtSecret: SECRET },
      watchLater: { maxSize: 500, defaultPageSize: 20, maxPageSize: 100, defaultSortOrder: 'desc' },
    });
  });

  test('reads and coerces values from the environment', () => {
    const config = loadConfig({
      JWT_SECRET: SECRET,
      PORT: '8080',
      WATCHLIST_MAX_SIZE: '50',
      DEFAULT_PAGE_SIZE: '5',
      MAX_PAGE_SIZE: '10',
      DEFAULT_SORT_ORDER: 'ASC',
    });
    expect(config.port).toBe(8080);
    expect(config.watchLater).toEqual({
      maxSize: 50,
      defaultPageSize: 5,
      maxPageSize: 10,
      defaultSortOrder: 'asc',
    });
  });

  test('returns a frozen object', () => {
    const config = loadConfig({ JWT_SECRET: SECRET });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.watchLater)).toBe(true);
  });

  test.each([
    [{}, /JWT_SECRET/],
    [{ JWT_SECRET: 'short' }, /JWT_SECRET/],
    [{ JWT_SECRET: SECRET, WATCHLIST_MAX_SIZE: '0' }, /WATCHLIST_MAX_SIZE/],
    [{ JWT_SECRET: SECRET, DEFAULT_PAGE_SIZE: '50', MAX_PAGE_SIZE: '10' }, /DEFAULT_PAGE_SIZE/],
    [{ JWT_SECRET: SECRET, DEFAULT_SORT_ORDER: 'random' }, /DEFAULT_SORT_ORDER/],
    [{ JWT_SECRET: SECRET, MONGO_URI: 'http://example.com' }, /MONGO_URI/],
  ])('fails fast on invalid configuration %#', (env, message) => {
    expect(() => loadConfig(env)).toThrow(message);
  });
});
