'use strict';

/**
 * Vercel entry point.
 * vercel.json rewrites every path here; the Node server exposes a single
 * (req, res) handler that keeps doing all routing and static file serving.
 */
module.exports = require('../core/app.js');
