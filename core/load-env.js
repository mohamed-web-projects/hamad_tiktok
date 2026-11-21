'use strict';

/**
 * Tiny zero-dependency .env loader, used with `node -r ./core/load-env.js`.
 * Existing environment variables always win over values from the file.
 */

const fs = require('fs');
const path = require('path');

const file = path.resolve(process.cwd(), '.env');
let text;
try {
  text = fs.readFileSync(file, 'utf8');
} catch (_) {
  // No .env file — that's fine; the app starts and reports OAuth as unavailable.
  text = '';
}

for (const rawLine of text.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;

  const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) continue;

  const [, key, rawValue] = match;
  if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;

  let value = rawValue.trim();
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\s+#.*$/, '').trim();
  }

  process.env[key] = value;
}
