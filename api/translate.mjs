/**
 * POST /api/translate
 * ------------------------------------------------------------------
 * Thin server-side proxy for the Otjiherero translation pipeline.
 *
 * Retrieval, prompting and validation all happen in the browser; this
 * endpoint exists only so a public deployment can hold the model API key
 * server-side instead of shipping it to every visitor.
 *
 * Works as:
 *   - a Vercel Node function (this file, zero config)
 *   - the handler mounted by scripts/rag-server.mjs for local development
 *
 * Configuration (server-side only — never prefixed with VITE_):
 *   LLM_API_KEY   / OPENAI_API_KEY    required
 *   LLM_BASE_URL  / OPENAI_BASE_URL   default https://api.openai.com/v1
 *   LLM_MODEL     / OPENAI_MODEL      default gpt-4o-mini
 *   LLM_MAX_TOKENS                    default 900
 *
 * When no key is configured the endpoint answers 501 and the client falls
 * back to asking the visitor for their own key.
 * ------------------------------------------------------------------
 */

const MAX_BODY_BYTES = 256 * 1024;
const MAX_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 12_000;

function readConfig() {
  return {
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl: (process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: Number(process.env.LLM_MAX_TOKENS || 900),
  };
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.reject(new Error('invalid-json'));
    }
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too-large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('invalid-json'));
      }
    });
    req.on('error', reject);
  });
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 'messages must be a non-empty array';
  if (messages.length > MAX_MESSAGES) return `too many messages (max ${MAX_MESSAGES})`;
  for (const message of messages) {
    if (!message || typeof message.content !== 'string') return 'each message needs string content';
    if (message.role !== 'system' && message.role !== 'user') return 'roles must be system or user';
    if (message.content.length > MAX_MESSAGE_CHARS) return 'message too long';
  }
  return null;
}

export default async function handler(req, res) {
  const config = readConfig();

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.end();
    return;
  }

  // health/availability probe used by the settings dialog
  if (req.method === 'GET') {
    send(res, 200, {
      ok: true,
      configured: Boolean(config.apiKey),
      model: config.apiKey ? config.model : null,
    });
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, { error: 'method-not-allowed' });
    return;
  }

  if (!config.apiKey) {
    send(res, 501, {
      error: 'not-configured',
      message: 'No LLM_API_KEY is set on the server. Add one, or use your own key in translation settings.',
    });
    return;
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch (err) {
    const reason = err?.message === 'too-large' ? 'request too large' : 'invalid JSON body';
    send(res, err?.message === 'too-large' ? 413 : 400, { error: 'bad-request', message: reason });
    return;
  }

  const invalid = validateMessages(payload?.messages);
  if (invalid) {
    send(res, 400, { error: 'bad-request', message: invalid });
    return;
  }

  const temperature = typeof payload.temperature === 'number'
    ? Math.min(1, Math.max(0, payload.temperature))
    : 0.2;

  const body = {
    model: config.model,
    messages: payload.messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: config.maxTokens,
    response_format: { type: 'json_object' },
  };

  let upstream;
  try {
    upstream = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55_000),
    });

    if (upstream.status === 400 || upstream.status === 422) {
      // some OpenAI-compatible servers reject response_format
      const text = await upstream.clone().text().catch(() => '');
      if (/response_format|json_object|unsupported/i.test(text)) {
        delete body.response_format;
        upstream = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(55_000),
        });
      }
    }
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    send(res, timedOut ? 504 : 502, {
      error: timedOut ? 'upstream-timeout' : 'upstream-unreachable',
      message: timedOut ? 'The model provider timed out.' : 'Could not reach the model provider.',
    });
    return;
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    send(res, upstream.status === 429 ? 429 : 502, {
      error: 'upstream-error',
      status: upstream.status,
      message: detail.slice(0, 400),
    });
    return;
  }

  const data = await upstream.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    send(res, 502, { error: 'empty-completion', message: 'The model returned no content.' });
    return;
  }

  send(res, 200, { text, model: data?.model ?? config.model });
}
