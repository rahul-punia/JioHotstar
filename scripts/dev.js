'use strict';

/**
 * Local development without installing MongoDB: boots an in-memory replica set
 * (transactions need one), starts the server against it and prints a test token.
 */
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { start } = require('../src/server');

async function main() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const env = {
    ...process.env,
    MONGO_URI: replSet.getUri(),
    JWT_SECRET: process.env.JWT_SECRET ?? 'local-dev-secret-change-me',
  };
  await start(env);

  const token = jwt.sign({ sub: 'dev-user-1' }, env.JWT_SECRET, { expiresIn: '1d' });
  console.info(`Dev token for user 'dev-user-1':\n${token}`);

  const stopDb = () => replSet.stop();
  process.once('SIGINT', stopDb);
  process.once('SIGTERM', stopDb);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
