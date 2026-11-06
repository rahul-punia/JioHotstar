'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');
const { buildContainer } = require('../../src/container');
const { loadConfig } = require('../../src/config');
const { JwtTokenVerifier } = require('../../src/common/auth/JwtTokenVerifier');
const {
  InMemoryWatchLaterRepository,
} = require('../../src/modules/watchLater/repositories/InMemoryWatchLaterRepository');

const SECRET = 'api-test-secret-123456';
const BASE = '/v1/watch-later';

function buildApp(env = {}) {
  const config = loadConfig({
    JWT_SECRET: SECRET,
    WATCHLIST_MAX_SIZE: '3',
    DEFAULT_PAGE_SIZE: '2',
    MAX_PAGE_SIZE: '5',
    ...env,
  });
  let tick = 0;
  const repository = new InMemoryWatchLaterRepository();
  const logger = { error: jest.fn(), info: jest.fn() };
  const container = buildContainer({
    config,
    repository,
    tokenVerifier: new JwtTokenVerifier({ secret: SECRET }),
    logger,
    clock: () => new Date(Date.UTC(2026, 0, 1) + 1000 * tick++),
  });
  return { app: createApp(container), repository, logger };
}

const tokenFor = (userId) => `Bearer ${jwt.sign({ sub: userId }, SECRET, { expiresIn: '5m' })}`;

describe('Watch Later API', () => {
  let app;
  let auth;

  beforeEach(() => {
    ({ app } = buildApp());
    auth = tokenFor('user-1');
  });

  const add = (contentId, authorization = auth) =>
    request(app).post(BASE).set('Authorization', authorization).send({ contentId });

  describe('authentication', () => {
    test.each([
      ['missing header', undefined],
      ['non-bearer scheme', 'Basic abc'],
      ['garbage token', 'Bearer not-a-jwt'],
      ['wrong secret', `Bearer ${jwt.sign({ sub: 'u' }, 'some-other-secret-value')}`],
      ['expired token', `Bearer ${jwt.sign({ sub: 'u', exp: 1 }, SECRET)}`],
      ['token without subject', `Bearer ${jwt.sign({ foo: 'bar' }, SECRET)}`],
    ])('rejects %s with 401', async (_label, authorization) => {
      const req = request(app).get(BASE);
      if (authorization) req.set('Authorization', authorization);
      const res = await req;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('takes the user from the token, ignoring any userId in the body', async () => {
      await request(app).post(BASE).set('Authorization', auth).send({ contentId: 'c1', userId: 'user-2' });
      const other = await request(app).get(BASE).set('Authorization', tokenFor('user-2'));
      expect(other.body.items).toEqual([]);
      const mine = await request(app).get(BASE).set('Authorization', auth);
      expect(mine.body.items).toHaveLength(1);
    });
  });

  describe('POST /v1/watch-later', () => {
    test('adds content and returns 201 with server-generated addedAt', async () => {
      const res = await request(app)
        .post(BASE)
        .set('Authorization', auth)
        .send({ contentId: 'movie_123', addedAt: '1999-01-01T00:00:00.000Z' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ contentId: 'movie_123', addedAt: '2026-01-01T00:00:00.000Z' });
    });

    test('returns 409 for a duplicate', async () => {
      await add('c1');
      const res = await add('c1');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONTENT_ALREADY_IN_WATCHLIST');
    });

    test('returns 422 when the configured max size is reached', async () => {
      await add('c1');
      await add('c2');
      await add('c3');
      const res = await add('c4');
      expect(res.status).toBe(422);
      expect(res.body.error).toEqual({
        code: 'WATCHLIST_LIMIT_REACHED',
        message: 'Watch later list cannot hold more than 3 items',
      });
    });

    test.each([
      ['missing contentId', {}],
      ['empty contentId', { contentId: '' }],
      ['non-string contentId', { contentId: 42 }],
      ['contentId with invalid characters', { contentId: 'a b/c' }],
      ['too long contentId', { contentId: 'x'.repeat(65) }],
    ])('returns 400 for %s', async (_label, body) => {
      const res = await request(app).post(BASE).set('Authorization', auth).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].field).toBe('contentId');
    });

    test('returns 400 for malformed JSON', async () => {
      const res = await request(app)
        .post(BASE)
        .set('Authorization', auth)
        .set('Content-Type', 'application/json')
        .send('{"contentId":');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_JSON');
    });
  });

  describe('DELETE /v1/watch-later/:contentId', () => {
    test('removes content and returns 204', async () => {
      await add('c1');
      const res = await request(app).delete(`${BASE}/c1`).set('Authorization', auth);
      expect(res.status).toBe(204);
      const list = await request(app).get(BASE).set('Authorization', auth);
      expect(list.body.items).toEqual([]);
    });

    test('is idempotent for content not in the list', async () => {
      const res = await request(app).delete(`${BASE}/never-added`).set('Authorization', auth);
      expect(res.status).toBe(204);
    });

    test('does not touch other users\' lists', async () => {
      await add('c1', tokenFor('user-2'));
      await request(app).delete(`${BASE}/c1`).set('Authorization', auth);
      const other = await request(app).get(BASE).set('Authorization', tokenFor('user-2'));
      expect(other.body.items).toHaveLength(1);
    });

    test('returns 400 for an invalid contentId', async () => {
      const res = await request(app).delete(`${BASE}/bad%20id`).set('Authorization', auth);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /v1/watch-later', () => {
    beforeEach(async () => {
      await add('c1');
      await add('c2');
      await add('c3');
    });

    test('returns the first page newest-first using configured defaults', async () => {
      const res = await request(app).get(BASE).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        items: [
          { contentId: 'c3', addedAt: '2026-01-01T00:00:02.000Z' },
          { contentId: 'c2', addedAt: '2026-01-01T00:00:01.000Z' },
        ],
        pagination: { pageNo: 1, pageSize: 2, totalItems: 3, totalPages: 2, hasNext: true },
      });
    });

    test('supports pageNo, pageSize and order query params', async () => {
      const res = await request(app)
        .get(BASE)
        .query({ pageNo: 2, pageSize: 2, order: 'ASC' })
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.items.map((i) => i.contentId)).toEqual(['c3']);
      expect(res.body.pagination).toEqual({
        pageNo: 2,
        pageSize: 2,
        totalItems: 3,
        totalPages: 2,
        hasNext: false,
      });
    });

    test('uses the configured default order', async () => {
      ({ app } = buildApp({ DEFAULT_SORT_ORDER: 'asc' }));
      await add('c1');
      await add('c2');
      const res = await request(app).get(BASE).set('Authorization', auth);
      expect(res.body.items.map((i) => i.contentId)).toEqual(['c1', 'c2']);
    });

    test.each([
      ['pageSize above the configured max', { pageSize: 6 }, 'pageSize'],
      ['pageSize of zero', { pageSize: 0 }, 'pageSize'],
      ['non-numeric pageNo', { pageNo: 'abc' }, 'pageNo'],
      ['pageNo beyond the max list size', { pageNo: 4 }, 'pageNo'],
      ['unknown order', { order: 'random' }, 'order'],
    ])('returns 400 for %s', async (_label, query, field) => {
      const res = await request(app).get(BASE).query(query).set('Authorization', auth);
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([expect.objectContaining({ field })]);
    });
  });

  describe('infrastructure', () => {
    test('GET /health is public', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    test('unknown routes return 404', async () => {
      const res = await request(app).get('/v1/unknown');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    test('unexpected errors return a generic 500 and are logged', async () => {
      let repository;
      let logger;
      ({ app, repository, logger } = buildApp());
      jest.spyOn(repository, 'list').mockRejectedValueOnce(new Error('connection reset'));
      const res = await request(app).get(BASE).set('Authorization', auth);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
