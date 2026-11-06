'use strict';

const { MongoClient } = require('mongodb');

/**
 * Connects with consistency-first defaults (CP): majority writes, majority reads and
 * primary-only reads, so a client never reads a list older than its own last write.
 */
async function connectMongo({ uri, dbName }) {
  const client = new MongoClient(uri, {
    writeConcern: { w: 'majority' },
    readConcern: { level: 'majority' },
    readPreference: 'primary',
    retryWrites: true,
    retryReads: true,
  });
  await client.connect();
  return { client, db: client.db(dbName) };
}

module.exports = { connectMongo };
