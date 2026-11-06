'use strict';

const { loadConfig } = require('./config');
const { connectMongo } = require('./db/mongo');
const { MongoWatchLaterRepository } = require('./modules/watchLater/repositories/MongoWatchLaterRepository');
const { JwtTokenVerifier } = require('./common/auth/JwtTokenVerifier');
const { buildContainer } = require('./container');
const { createApp } = require('./app');

async function start(env = process.env, logger = console) {
  const config = loadConfig(env);
  const { client, db } = await connectMongo(config.mongo);

  const repository = new MongoWatchLaterRepository({ client, db });
  await repository.ensureIndexes();

  const container = buildContainer({
    config,
    repository,
    tokenVerifier: new JwtTokenVerifier({ secret: config.auth.jwtSecret }),
    logger,
  });
  const server = createApp(container).listen(config.port, () => {
    logger.info(`Watch later service listening on port ${config.port}`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await client.close();
      process.exit(0);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  return { server, client };
}

module.exports = { start };
