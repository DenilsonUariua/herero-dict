/**
 * Model access layer.
 *
 * Prefers a server-side proxy (`/api/translate`) so a production deployment
 * never ships an API key to the browser. Falls back to a direct browser call
 * with the user's own key when no proxy is configured, so the feature is
 * usable on a fresh clone with zero backend.
 */

import { isLocalProvider } from './settings-core';
import { RagError, type RagSettings } from './types';
import type { ChatMessage } from './prompt';

export interface CompletionRequest {
  messages: ChatMessage[];
  settings: RagSettings;
  signal?: AbortSignal;
  temperature?: number;
}

export interface CompletionResponse {
  text: string;
  model: string;
  via: 'server' | 'byok';
  /** The provider stopped at the output-token cap, so `text` may be partial. */
  truncated?: boolean;
}

const TIMEOUT_MS = 60_000;

export const TRUNCATED_MESSAGE =
  'The model ran out of output tokens before it finished the answer. Try a shorter sentence, or raise LLM_MAX_TOKENS on the server.';

function apiBase(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/api/translate`;
}

function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), ms);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

function mapHttpError(status: number, body: string): RagError {
  // The proxy tags its failures with a machine-readable `error` code and a
  // human `message`. Prefer those over the bare status number.
  const detail = parseErrorBody(body);
  if (detail.code === 'upstream-timeout') {
    return new RagError('timeout', 'The model provider timed out. Try a shorter sentence.');
  }
  if (detail.code === 'truncated') return new RagError('bad-response', TRUNCATED_MESSAGE);
  if (detail.code === 'not-configured') {
    return new RagError('server', 'No translation proxy is configured on this deployment.');
  }
  if (detail.code === 'upstream-error' && detail.upstreamStatus === 429) {
    return new RagError('rate-limit', 'The model provider is rate limiting requests. Try again in a moment.');
  }
  if (detail.code === 'upstream-error' && detail.message) {
    return new RagError('server', `The model provider rejected the request: ${detail.message.slice(0, 200)}`);
  }

  if (status === 401 || status === 403) {
    return new RagError('bad-key', 'The API key was rejected. Check the key in translation settings.');
  }
  if (status === 429) {
    return new RagError('rate-limit', 'The model provider is rate limiting requests. Try again in a moment.');
  }
  if (status >= 500) {
    return new RagError('server', `The model provider returned an error (${status}).`);
  }
  return new RagError('unknown', `Request failed (${status}): ${body.slice(0, 200)}`);
}

function parseErrorBody(body: string): { code?: string; message?: string; upstreamStatus?: number } {
  try {
    const data = JSON.parse(body) as Record<string, unknown>;
    const code = typeof data?.error === 'string' ? data.error : undefined;
    const message = typeof data?.message === 'string' ? data.message : undefined;
    const upstreamStatus = typeof data?.status === 'number' ? data.status : undefined;
    return { code, message, upstreamStatus };
  } catch {
    return {};
  }
}

async function viaServer({ messages, signal, temperature }: CompletionRequest): Promise<CompletionResponse> {
  const { signal: timed, cleanup } = withTimeout(signal, TIMEOUT_MS);
  try {
    const res = await fetch(apiBase(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, temperature: temperature ?? 0.2 }),
      signal: timed,
    });

    if (res.status === 404 || res.status === 405 || res.status === 501) {
      throw new RagError('server', 'No translation proxy is configured on this deployment.');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw mapHttpError(res.status, text);
    }

    const data = await res.json().catch(() => null);
    if (!data?.text) throw new RagError('bad-response', 'The proxy returned an empty response.');
    return {
      text: String(data.text),
      model: String(data.model ?? 'proxy'),
      via: 'server',
      truncated: Boolean(data.truncated),
    };
  } catch (err) {
    if (err instanceof RagError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new RagError('timeout', 'The translation request timed out.');
    }
    throw new RagError('server', 'Could not reach the translation proxy.');
  } finally {
    cleanup();
  }
}

async function viaByok({ messages, settings, signal, temperature }: CompletionRequest): Promise<CompletionResponse> {
  const keyless = isLocalProvider(settings.baseUrl);
  if (!settings.apiKey && !keyless) {
    throw new RagError('no-key', 'No API key configured.');
  }

  const endpoint = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    temperature: temperature ?? 0.2,
    response_format: { type: 'json_object' },
  };

  const send = async (payload: Record<string, unknown>) => {
    const { signal: timed, cleanup } = withTimeout(signal, TIMEOUT_MS);
    try {
      return await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: timed,
      });
    } finally {
      cleanup();
    }
  };

  let res: Response;
  try {
    res = await send(body);
    // Not every OpenAI-compatible server supports response_format.
    if (res.status === 400 || res.status === 422) {
      const text = await res.clone().text().catch(() => '');
      if (/response_format|json_object|unsupported/i.test(text)) {
        delete body.response_format;
        res = await send(body);
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new RagError('timeout', 'The translation request timed out.');
    }
    throw new RagError('network', 'Could not reach the model provider. Check the base URL and your connection.');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw mapHttpError(res.status, text);
  }

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new RagError('bad-response', 'The model returned an empty response.');
  return {
    text: String(text),
    model: String(data?.model ?? settings.model),
    via: 'byok',
    truncated: data?.choices?.[0]?.finish_reason === 'length',
  };
}

export async function requestCompletion(req: CompletionRequest): Promise<CompletionResponse> {
  if (req.settings.mode === 'byok') return viaByok(req);

  try {
    return await viaServer(req);
  } catch (err) {
    // 'server' mode means the user explicitly wants the proxy only.
    if (req.settings.mode === 'server') throw err;
    // auto: no proxy deployed (or it is down) -> use the browser key if we have one
    if (req.settings.apiKey || isLocalProvider(req.settings.baseUrl)) return viaByok(req);
    throw err instanceof RagError && err.code !== 'server'
      ? err
      : new RagError(
          'no-key',
          'No translation service is configured. Add an API key in translation settings.',
        );
  }
}

/** Small "is the model reachable?" probe used by the settings dialog. */
export async function testConnection(settings: RagSettings): Promise<string> {
  const res = await requestCompletion({
    messages: [
      { role: 'system', content: 'Reply with the single word: ready' },
      { role: 'user', content: 'ping' },
    ],
    settings,
    temperature: 0,
  });
  return `${res.via === 'server' ? 'Server proxy' : settings.model} responded: ${res.text.trim().slice(0, 40)}`;
}

export interface ServerProbe {
  available: boolean;
  configured: boolean;
  model: string | null;
}

/** Ask the deployment whether a server-side key is present. */
export async function probeServer(): Promise<ServerProbe> {
  try {
    const res = await fetch(apiBase(), { method: 'GET' });
    if (!res.ok) return { available: false, configured: false, model: null };
    const data = await res.json().catch(() => null);
    if (!data || typeof data.configured !== 'boolean') {
      return { available: false, configured: false, model: null };
    }
    return { available: true, configured: data.configured, model: data.model ?? null };
  } catch {
    return { available: false, configured: false, model: null };
  }
}
