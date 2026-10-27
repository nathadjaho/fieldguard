// Local stand-in for Vercel: serves the same handlers from api/ on port 8787,
// with the small subset of the req/res helpers they use. Reads .env if present.
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const routes = {
  '/api/propose': (await import('../api/propose.js')).default,
  '/api/health': (await import('../api/health.js')).default
};

http.createServer(async (req, res) => {
  const handler = routes[req.url.split('?')[0]];
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); return res; };
  if (!handler) return res.status(404).json({ error: 'not found' });
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { req.body = raw ? JSON.parse(raw) : {}; } catch { return res.status(400).json({ error: 'invalid JSON' }); }
  await handler(req, res);
}).listen(8787, () => console.log('[fieldguard] API on http://localhost:8787'));
