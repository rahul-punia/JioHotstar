'use strict';

const { WatchLaterService } = require('./modules/watchLater/watchLater.service');
const { WatchLaterController } = require('./modules/watchLater/watchLater.controller');
const { buildWatchLaterSchemas } = require('./modules/watchLater/watchLater.validation');
const { createAuthenticate } = require('./common/middleware/authenticate');

/**
 * Composition root: the only place that knows which concrete implementations are used.
 * Infrastructure (repository, token verifier) is passed in so tests and the server can
 * supply different ones.
 */
function buildContainer({ config, repository, tokenVerifier, logger = console, clock }) {
  const service = new WatchLaterService({ repository, config: config.watchLater, clock });
  return {
    config,
    logger,
    service,
    watchLater: {
      controller: new WatchLaterController({ service }),
      schemas: buildWatchLaterSchemas(config.watchLater),
    },
    authenticate: createAuthenticate(tokenVerifier),
  };
}

module.exports = { buildContainer };
