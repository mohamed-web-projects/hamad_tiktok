'use strict';

/**
 * Local / Render entry point.
 * Request handling lives in core/app.js so Vercel imports it directly from
 * api/index.js. This file is deliberately NOT named server.js / index.js /
 * app.js at the root, otherwise Vercel uses it as the root entrypoint and
 * its static rewrites stop working.
 */

const handler = require('./core/app.js');
const { startLocalServer } = require('./core/local-runner.js');

startLocalServer(handler);

module.exports = handler;
