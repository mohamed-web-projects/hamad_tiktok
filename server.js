'use strict';

/**
 * Hamad TikTok — single-process Node server (zero dependencies).
 *
 * Responsibilities
 *  - Serve the static-ish pages (index / upload / faq / privacy / terms / setup)
 *  - Real TikTok Login Kit OAuth 2.0 flow (PKCE + state + signed session cookie)
 *  - Expose /api/tiktok/status, /api/tiktok/disconnect, /api/config
 *  - /healthz for hosting platforms
 *
 * If TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET are missing the server still runs
 * in "demo" mode: the UI clearly labels everything as تجريبي and points the user
 * to /setup.html. Nothing pretends to be a real connection.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const VIEWS_DIR = path.join(ROOT, 'views');
const DATA_DIR = path.join(ROOT, 'data');
const SESSION_FILE = path.join(DATA_DIR, 'sessions.json');

const PORT = Number(process.env.PORT || 8899);
const SITE_NAME = 'Hamad TikTok';

const CFG = {
  clientKey: (process.env.TIKTOK_CLIENT_KEY || '').trim(),
  clientSecret: (process.env.TIKTOK_CLIENT_SECRET || '').trim(),
  redirectUri: (process.env.TIKTOK_REDIRECT_URI || '').trim(),
  sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production-' + crypto.randomBytes(8).toString('hex'),
  scopes: (process.env.TIKTOK_SCOPES ||
    'user.info.basic,user.info.profile,user.info.stats,video.publish')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

const TIKTOK = {
  authorize: 'https://www.tiktok.com/v2/auth/authorize/',
  token: 'https://open.tiktokapis.com/v2/oauth/token/',
  userInfo: 'https://open.tiktokapis.com/v2/user/info/',
};

const isConfigured = () => Boolean(CFG.clientKey && CFG.clientSecret);

/* ------------------------------------------------------------------ *
 * Tiny file helpers
 * ------------------------------------------------------------------ */

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) {}
}

ensureDir(DATA_DIR);

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

let writeTimer = null;
function writeJSONSoon(file, value) {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      fs.writeFileSync(file, JSON.stringify(value, null, 2));
    } catch (err) {
      console.error('[warn] could not persist sessions:', err.message);
    }
  }, 250);
}

/* ------------------------------------------------------------------ *
 * Sessions (file-backed so a restart does not log everyone out)
 * ------------------------------------------------------------------ */

const sessions = new Map(Object.entries(readJSON(SESSION_FILE, {})));
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function persistSessions() {
  const obj = {};
  for (const [sid, s] of sessions) obj[sid] = s;
  writeJSONSoon(SESSION_FILE, obj);
}

function getSession(req) {
  const sid = parseCookies(req).sid;
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s) return null;
  if (s.expiresAt && s.expiresAt < Date.now()) {
    sessions.delete(sid);
    persistSessions();
    return null;
  }
  return { sid, ...s };
}

function createSession(res) {
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, { createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
  persistSessions();
  setCookie(res, 'sid', sid, SESSION_TTL_MS);
  return sid;
}

function dropSession(req, res) {
  const sid = parseCookies(req).sid;
  if (sid) sessions.delete(sid);
  persistSessions();
  setCookie(res, 'sid', '', 0);
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isHttps(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https' || Boolean(req.socket && req.socket.encrypted);
}

function setCookie(res, name, value, maxAgeMs) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (isHttps(res.req)) parts.push('Secure');
  appendHeader(res, 'Set-Cookie', parts.join('; '));
}

function appendHeader(res, name, value) {
  const prev = res.getHeader(name);
  if (!prev) res.setHeader(name, value);
  else res.setHeader(name, Array.isArray(prev) ? [...prev, value] : [prev, value]);
}

/* ------------------------------------------------------------------ *
 * OAuth state + PKCE
 * ------------------------------------------------------------------ */

const pendingStates = new Map(); // state -> { verifier, createdAt }
const STATE_TTL_MS = 10 * 60 * 1000;

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function newState() {
  const state = base64url(crypto.randomBytes(16));
  const verifier = base64url(crypto.randomBytes(48));
  pendingStates.set(state, { verifier, createdAt: Date.now() });
  // opportunistic cleanup
  for (const [k, v] of pendingStates) {
    if (Date.now() - v.createdAt > STATE_TTL_MS) pendingStates.delete(k);
  }
  return { state, verifier };
}

function challengeFor(verifier) {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

/* ------------------------------------------------------------------ *
 * HTTP plumbing
 * ------------------------------------------------------------------ */

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, {
    'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(buf);
}

function sendJSON(res, status, data) {
  send(res, status, JSON.stringify(data), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
}

function redirect(res, location, status = 302) {
  res.writeHead(status, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function serveFile(res, baseDir, relPath) {
  const safe = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(baseDir, safe);
  if (!full.startsWith(baseDir)) return send(res, 403, 'Forbidden');
  fs.readFile(full, (err, buf) => {
    if (err) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    const ext = path.extname(full).toLowerCase();
    send(res, 200, buf, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
  });
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

/* ------------------------------------------------------------------ *
 * TikTok API calls
 * ------------------------------------------------------------------ */

async function exchangeCode(code, verifier) {
  const body = new URLSearchParams({
    client_key: CFG.clientKey,
    client_secret: CFG.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: CFG.redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch(TIKTOK.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(`token endpoint returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || `token request failed (${res.status})`);
  }
  return data; // access_token, expires_in, refresh_token, refresh_expires_in, open_id, scope
}

async function refreshToken(refreshTokenValue) {
  const body = new URLSearchParams({
    client_key: CFG.clientKey,
    client_secret: CFG.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
  });
  const res = await fetch(TIKTOK.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error_description || 'refresh failed');
  return data;
}

async function fetchUser(accessToken) {
  const fields = 'open_id,union_id,avatar_url,display_name,username,profile_deep_link';
  const res = await fetch(`${TIKTOK.userInfo}?fields=${encodeURIComponent(fields)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.error && data.error.code && data.error.code !== 'ok')) {
    throw new Error(data.error?.message || `user info failed (${res.status})`);
  }
  return data.data?.user || {};
}

/* ------------------------------------------------------------------ *
 * Route handlers
 * ------------------------------------------------------------------ */

const PAGES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/upload': 'upload.html',
  '/upload.html': 'upload.html',
  '/faq': 'faq.html',
  '/faq.html': 'faq.html',
  '/privacy': 'privacy.html',
  '/privacy.html': 'privacy.html',
  '/terms': 'terms.html',
  '/terms.html': 'terms.html',
  '/setup': 'setup.html',
  '/setup.html': 'setup.html',
};

function publicSiteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || (isHttps(req) ? 'https' : 'http')).split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function effectiveRedirectUri(req) {
  return CFG.redirectUri || `${publicSiteUrl(req)}/auth/tiktok/callback`;
}

function publicStatus(req, sessionOverride) {
  const session = sessionOverride !== undefined ? sessionOverride : getSession(req);
  const user = session?.user || null;
  return {
    site: SITE_NAME,
    configured: isConfigured(),
    siteUrl: publicSiteUrl(req),
    redirectUri: effectiveRedirectUri(req),
    scopes: CFG.scopes,
    connected: Boolean(user),
    demo: Boolean(session?.demo),
    user: user
      ? {
          username: user.username || null,
          displayName: user.displayName || null,
          avatarUrl: user.avatarUrl || null,
          openId: user.openId || null,
          profileLink: user.profileLink || null,
          scopes: user.scopes || [],
          connectedAt: user.connectedAt || null,
        }
      : null,
  };
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  res.req = req;

  /* --- health --- */
  if (pathname === '/healthz') {
    return sendJSON(res, 200, { ok: true, uptime: process.uptime(), configured: isConfigured() });
  }

  /* --- API --- */
  if (pathname === '/api/config') {
    return sendJSON(res, 200, {
      site: SITE_NAME,
      configured: isConfigured(),
      siteUrl: publicSiteUrl(req),
      redirectUri: effectiveRedirectUri(req),
      scopes: CFG.scopes,
    });
  }

  if (pathname === '/api/tiktok/status') {
    const status = publicStatus(req);
    // Try a silent refresh when the access token is about to expire.
    const session = getSession(req);
    if (session?.user?.refreshToken && session.user.tokenExpiresAt && session.user.tokenExpiresAt - Date.now() < 5 * 60 * 1000) {
      try {
        const refreshed = await refreshToken(session.user.refreshToken);
        session.user.accessToken = refreshed.access_token;
        session.user.refreshToken = refreshed.refresh_token || session.user.refreshToken;
        session.user.tokenExpiresAt = Date.now() + (refreshed.expires_in || 86400) * 1000;
        sessions.set(session.sid, session);
        persistSessions();
      } catch (err) {
        console.warn('[tiktok] refresh failed:', err.message);
      }
    }
    return sendJSON(res, 200, status);
  }

  if (pathname === '/api/tiktok/demo' && req.method === 'POST') {
    // Explicit, clearly-labelled demo mode. Never silently fakes a connection.
    let sid = parseCookies(req).sid;
    if (!sid || !sessions.has(sid)) sid = createSession(res);
    const session = sessions.get(sid);
    session.demo = true;
    session.user = {
      username: 'demo.creator',
      displayName: 'حساب تجريبي',
      avatarUrl: null,
      openId: 'demo',
      scopes: [],
      connectedAt: Date.now(),
      demo: true,
    };
    sessions.set(sid, session);
    persistSessions();
    return sendJSON(res, 200, publicStatus(req, session));
  }

  if (pathname === '/api/tiktok/disconnect' && req.method === 'POST') {
    const session = getSession(req);
    if (session) {
      session.user = null;
      session.demo = false;
      sessions.set(session.sid, session);
      persistSessions();
    }
    return sendJSON(res, 200, publicStatus(req));
  }

  /* --- OAuth start --- */
  if (pathname === '/auth/tiktok') {
    if (!isConfigured()) {
      return redirect(res, '/setup.html?state=missing-keys');
    }
    const { state, verifier } = newState();
    const params = new URLSearchParams({
      client_key: CFG.clientKey,
      scope: CFG.scopes.join(','),
      response_type: 'code',
      redirect_uri: effectiveRedirectUri(req),
      state,
      code_challenge: challengeFor(verifier),
      code_challenge_method: 'S256',
    });
    return redirect(res, `${TIKTOK.authorize}?${params.toString()}`);
  }

  /* --- OAuth callback --- */
  if (pathname === '/auth/tiktok/callback') {
    const error = url.searchParams.get('error');
    if (error) {
      return redirect(res, `/upload.html?error=${encodeURIComponent(url.searchParams.get('error_description') || error)}`);
    }
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const pending = state && pendingStates.get(state);
    if (!code || !pending) {
      return redirect(res, '/upload.html?error=' + encodeURIComponent('state_mismatch'));
    }
    pendingStates.delete(state);

    try {
      const tokens = await exchangeCode(code, pending.verifier);
      let profile = {};
      try {
        profile = await fetchUser(tokens.access_token);
      } catch (err) {
        console.warn('[tiktok] user info failed:', err.message);
      }

      let sid = parseCookies(req).sid;
      if (!sid || !sessions.has(sid)) sid = createSession(res);
      const session = sessions.get(sid);
      session.demo = false;
      session.user = {
        username: profile.username || profile.display_name || 'tiktok_user',
        displayName: profile.display_name || profile.username || null,
        avatarUrl: profile.avatar_url || null,
        openId: tokens.open_id || profile.open_id || null,
        profileLink: profile.profile_deep_link || null,
        scopes: String(tokens.scope || '').split(',').filter(Boolean),
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        tokenExpiresAt: Date.now() + (tokens.expires_in || 86400) * 1000,
        connectedAt: Date.now(),
      };
      sessions.set(sid, session);
      persistSessions();
      return redirect(res, '/upload.html?connected=1');
    } catch (err) {
      console.error('[tiktok] callback failed:', err.message);
      return redirect(res, '/upload.html?error=' + encodeURIComponent(err.message.slice(0, 180)));
    }
  }

  /* --- pages --- */
  if (req.method === 'GET' && PAGES[pathname]) {
    return serveFile(res, VIEWS_DIR, PAGES[pathname]);
  }

  /* --- assets --- */
  if (req.method === 'GET') {
    const ext = path.extname(pathname).toLowerCase();
    if (MIME[ext]) return serveFile(res, PUBLIC_DIR, pathname.replace(/^\//, ''));
  }

  return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[error]', err);
    if (!res.headersSent) send(res, 500, 'Internal error', { 'Content-Type': 'text/plain; charset=utf-8' });
  });
});

server.listen(PORT, () => {
  console.log(`\n  ${SITE_NAME} running → http://localhost:${PORT}`);
  console.log(`  TikTok OAuth: ${isConfigured() ? 'CONFIGURED ✓' : 'NOT configured (demo mode)'}`);
  if (isConfigured()) console.log(`  Redirect URI: ${CFG.redirectUri || '(derived from request host)'}`);
  console.log('');
});
