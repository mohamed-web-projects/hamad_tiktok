'use strict';

/**
 * Local / Render entry point.
 * Request handling lives in core/app.js so Vercel imports it directly from
 * api/index.js. Keeping `listen()` out of this file avoids Vercel mistaking
 * it for a zero-config Node server that would shadow the static rewrites.
 */

const handler = require('./core/app.js');
const { startLocalServer } = require('./core/local-runner.js');

startLocalServer(handler);

module.exports = handler;
