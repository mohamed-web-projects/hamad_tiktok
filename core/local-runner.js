'use strict';

/** Starts the HTTP server for local development / Render. */
function startLocalServer(handler) {
  const http = require('http');
  const PORT = Number(process.env.PORT || 8899);
  const server = http.createServer(handler);

  server.listen(PORT, () => {
    console.log(`\n  Hamad TikTok running → http://localhost:${PORT}`);
    console.log('  TikTok OAuth: ' + (process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET ? 'CONFIGURED ✓' : 'NOT configured'));
    console.log('');
  });

  return server;
}

module.exports = { startLocalServer };
