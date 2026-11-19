'use strict';

/**
 * Local / Render entry point.
 * Request handling lives in core/app.js so Vercel can import it directly
 * from api/index.js without this file ever being required in production.
 */

const http = require('http');
const handler = require('./core/app.js');

const PORT = Number(process.env.PORT || 8899);

const server = http.createServer(handler);
server.listen(PORT, () => {
  console.log(`\n  Hamad TikTok running → http://localhost:${PORT}`);
  console.log('  TikTok OAuth: ' + (process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET ? 'CONFIGURED ✓' : 'NOT configured (demo mode)'));
  console.log('');
});

module.exports = handler;
