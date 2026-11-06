'use strict';

const express = require('express');
const { createWatchLaterRouter } = require('./modules/watchLater/watchLater.routes');
const { notFoundHandler, createErrorHandler } = require('./common/middleware/errorHandler');

/** Builds the Express app without binding a port, so it can be tested with supertest. */
function createApp(container) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use(
    '/v1/watch-later',
    createWatchLaterRouter({
      controller: container.watchLater.controller,
      schemas: container.watchLater.schemas,
      authenticate: container.authenticate,
    }),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(container.logger));
  return app;
}

module.exports = { createApp };
