# JioHotstar — Watch Later Service

Lets a signed-in user add content to a "Watch Later" list, remove it, and page through it ordered by when it was added.

## Quick start

```bash
npm install
npm test          # unit + integration tests with coverage (first run downloads a mongod binary)
npm run dev       # starts the API on an in-memory MongoDB replica set and prints a test token
npm start         # production entry (init.js); needs MONGO_URI + JWT_SECRET, see .env.example
```

## API

Every endpoint needs `Authorization: Bearer <JWT>`. The user id comes from the token's `sub` claim, never from the request.

| Method & path | Request | Success | Errors |
|---|---|---|---|
| `POST /v1/watch-later` | `{ "contentId": "movie_123" }` | `201 { contentId, addedAt }` | 400, 401, 409 `CONTENT_ALREADY_IN_WATCHLIST`, 422 `WATCHLIST_LIMIT_REACHED` |
| `DELETE /v1/watch-later/:contentId` | – | `204`, even when the item isn't in the list | 400, 401 |
| `GET /v1/watch-later?pageNo=1&pageSize=20&order=desc` | all query params optional | `200 { items: [{ contentId, addedAt }], pagination: { pageNo, pageSize, totalItems, totalPages, hasNext } }` | 400, 401 |

- The server sets `addedAt`, so clients can't fake the ordering.
- `contentId`: 1–64 characters from `[A-Za-z0-9_-]`.
- Every error has the shape `{ "error": { "code", "message", "details?" } }`.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `WATCHLIST_MAX_SIZE` | 500 | Most items one user's list can hold |
| `DEFAULT_PAGE_SIZE` | 20 | Page size when the client doesn't send one |
| `MAX_PAGE_SIZE` | 100 | Largest page size a client can ask for |
| `DEFAULT_SORT_ORDER` | `desc` | `desc` = newest first, `asc` = oldest first |
| `MONGO_URI` / `MONGO_DB_NAME` | local replica set / `jiohotstar` | Must point at a replica set or sharded cluster, because transactions need one |
| `JWT_SECRET` | – (required) | HS256 secret for verifying tokens |
| `PORT` | 3000 | HTTP port |

Bad values stop the service at startup instead of surfacing later.

## Design

### Layers
```
routes → validate (Joi) → controller → WatchLaterService → WatchLaterRepository (contract)
                                                              ├── MongoWatchLaterRepository
                                                              └── InMemoryWatchLaterRepository
```
- **Repository pattern and dependency inversion:** the service depends only on the `WatchLaterRepository` contract. Moving to a different store (e.g. DynamoDB) or wrapping it in a cache decorator means adding one class. One shared contract test suite (`tests/contract`) runs against every implementation, so they stay interchangeable.
- **Composition root:** `src/container.js` is the only place that picks concrete classes. Nothing creates singletons when a module is loaded.
- **Value objects:** `Pagination` and `SortOrder` are immutable and validate themselves.
- **Error hierarchy:** subclasses of `AppError` carry their HTTP status and code. One middleware turns them into responses.

### Storage model (MongoDB)

| Collection | Document | Indexes |
|---|---|---|
| `watch_later_items` | `{ _id, userId, contentId, addedAt }` | unique `{userId, contentId}` (blocks duplicates); `{userId, addedAt:-1, _id:-1}` (ordered pages; `_id` breaks ties between equal timestamps) |
| `watch_later_counters` | `{ _id: userId, count }` | – |

- **Add:** one transaction inserts the item (a duplicate key error becomes 409), then increments the counter only if `count < max`. If the counter wasn't incremented, the transaction aborts and returns 422, and the insert is rolled back. This holds even when many adds for the same user arrive at once (covered by tests).
- **Remove:** one transaction deletes the item and decrements the counter.
- **List:** reads one page through the `{userId, addedAt}` index plus the counter document. It never reads the whole list.
- **Consistency over availability:** writes and reads use majority concern and read from the primary only. There is no cache in v1, because a cache would weaken that guarantee.

### Production sharding
Shard both collections on hashed `userId`. That puts all of one user's data on a single shard, so every transaction stays on one shard:
```js
sh.shardCollection('jiohotstar.watch_later_items',    { userId: 'hashed' })
sh.shardCollection('jiohotstar.watch_later_counters', { _id: 'hashed' })
```

### Why MongoDB
Compared against DynamoDB, Cassandra and Postgres. MongoDB is consistent, blocks duplicates with a unique index, enforces the max size with cheap single-shard transactions, supports page-number pagination, and can be tested locally without Docker. DynamoDB came second: it supports only cursor pagination and costs twice as much for consistent reads and transactions. Cassandra lets reads go stale and handles duplicate checks and size limits poorly. Postgres is hard to operate sharded at 100M daily users.

## Tests
- `tests/unit`: domain objects, config, the service, and the in-memory repository run against the contract.
- `tests/integration`: the Mongo repository against a real in-memory replica set (contract, concurrency, rollback, indexes) and the HTTP API through supertest.
- Coverage threshold is 90%. `src/server.js` is left out because it only wires things together and handles signals; `npm run dev` exercises it.
