/**
 * rag-server.mjs
 * ------------------------------------------------------------------
 * Local stand-in for the serverless function, so `/api/translate` works
 * during `npm run dev` without deploying anything.
 *
 *   node scripts/rag-server.mjs      # port 3401 (RAG_PORT to override)
 *
 * The Vite dev server proxies /api/* here (see vite.config.ts).
 * It reads the same server-side env vars as api/translate.mjs from .env:
 *   LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
 * ------------------------------------------------------------------
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../api/translate.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(projectRoot, '.env');

// Minimal .env loader — the server needs the non-VITE_ vars that Vite ignores.
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

const port = Number(process.env.RAG_PORT || 3401);

const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0];

  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (url !== '/api/translate' && url !== '/api/translate/') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'not-found' }));
    return;
  }

  try {
    await handler(req, res);
  } catch (err) {
    console.error('[rag-server] handler error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'internal', message: String(err?.message ?? err) }));
    }
  }
});

server.listen(port, () => {
  const configured = Boolean(process.env.LLM_API_KEY || process.env.OPENAI_API_KEY);
  console.log(`  translation proxy  http://localhost:${port}/api/translate`);
  console.log(`  model key          ${configured ? 'configured' : 'NOT configured (client will ask for a key)'}\n`);
});
