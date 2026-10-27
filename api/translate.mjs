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
 *   LLM_MAX_TOKENS                    default 4096
 *   LLM_REASONING_EFFORT              optional; 'low' / 'none' cuts latency on
 *                                     thinking models (Gemini 2.5, o-series)
 *
 * When no key is configured the endpoint answers 501 and the client falls
 * back to asking the visitor for their own key.
 *
 * Token budget note: reasoning models bill their hidden "thinking" against
 * max_tokens. A budget that only fits the answer (the old 900) gets consumed
 * by the reasoning pass, the JSON is cut off mid-string, and the client sees
 * an unparseable reply. Hence the larger default plus the retry below.
 * ------------------------------------------------------------------
 */

const MAX_BODY_BYTES = 256 * 1024;
const MAX_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 12_000;

/** Total time we are willing to spend on the upstream provider, retry included. */
const UPSTREAM_BUDGET_MS = 55_000;
/** Never ask for more than this, whatever LLM_MAX_TOKENS says. */
const MAX_TOKENS_CEILING = 16_384;

function readConfig() {
  const maxTokens = Number(process.env.LLM_MAX_TOKENS || 4096);
  return {
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl: (process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 4096,
    reasoningEffort: (process.env.LLM_REASONING_EFFORT || '').trim(),
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

/**
 * One upstream call.
 * Returns { ok: true, text, finishReason, model } or { ok: false, status, code, message }.
 * Never throws — callers turn the failure into an HTTP response.
 */
async function callUpstream(config, base, maxTokens, timeoutMs) {
  const send = (body) =>
    fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

  const body = { ...base, max_tokens: maxTokens };

  let upstream;
  try {
    upstream = await send(body);

    // Some OpenAI-compatible servers reject optional parameters. Drop the one
    // they complain about and retry instead of failing the whole request.
    if (upstream.status === 400 || upstream.status === 422) {
      const detail = await upstream.clone().text().catch(() => '');
      let dropped = false;
      if ('response_format' in body && /response_format|json_object/i.test(detail)) {
        delete body.response_format;
        dropped = true;
      }
      if ('reasoning_effort' in body && /reasoning_effort/i.test(detail)) {
        delete body.reasoning_effort;
        dropped = true;
      }
      if (dropped) upstream = await send(body);
    }
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      code: timedOut ? 'upstream-timeout' : 'upstream-unreachable',
      message: timedOut ? 'The model provider timed out.' : 'Could not reach the model provider.',
    };
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return {
      ok: false,
      status: upstream.status === 429 ? 429 : 502,
      code: 'upstream-error',
      message: detail.slice(0, 400) || `The model provider returned ${upstream.status}.`,
      upstreamStatus: upstream.status,
    };
  }

  const data = await upstream.json().catch(() => null);
  const choice = data?.choices?.[0];
  const text = choice?.message?.content;
  if (!text) {
    return { ok: false, status: 502, code: 'empty-completion', message: 'The model returned no content.' };
  }

  return {
    ok: true,
    text: String(text),
    finishReason: choice?.finish_reason ?? null,
    model: data?.model ?? config.model,
  };
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
      maxTokens: config.maxTokens,
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

  const base = {
    model: config.model,
    messages: payload.messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    response_format: { type: 'json_object' },
  };
  if (config.reasoningEffort) base.reasoning_effort = config.reasoningEffort;

  const deadline = Date.now() + UPSTREAM_BUDGET_MS;
  const remaining = () => Math.max(5_000, deadline - Date.now());

  const budget = Math.min(config.maxTokens, MAX_TOKENS_CEILING);
  let result = await callUpstream(config, base, budget, remaining());

  // Reasoning models can spend the whole budget thinking and leave nothing for
  // the answer. One retry with double the room fixes it; keep whichever reply
  // is more complete.
  if (result.ok && result.finishReason === 'length' && budget < MAX_TOKENS_CEILING) {
    const bigger = Math.min(MAX_TOKENS_CEILING, budget * 2);
    const retry = await callUpstream(config, base, bigger, remaining());
    if (retry.ok && retry.text.length >= result.text.length) result = retry;
  }

  if (!result.ok) {
    const { status, code, message, upstreamStatus } = result;
    send(res, status, { error: code, status: upstreamStatus, message });
    return;
  }

  send(res, 200, {
    text: result.text,
    model: result.model,
    finishReason: result.finishReason,
    // true when the provider stopped at the token cap: the client should
    // expect a partial reply rather than a well-formed document
    truncated: result.finishReason === 'length',
  });
}

