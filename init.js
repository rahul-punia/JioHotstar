'use strict';

const { start } = require('./src/server');

start().catch((err) => {
  console.error('Failed to start watch later service', err);
  process.exit(1);
});
