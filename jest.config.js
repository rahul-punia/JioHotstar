'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // The first Mongo integration run downloads a mongod binary.
  testTimeout: 120000,
  collectCoverageFrom: [
    'src/**/*.js',
    // Process entry point: wiring + signal handling, exercised manually via `npm run dev`.
    '!src/server.js',
  ],
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};
