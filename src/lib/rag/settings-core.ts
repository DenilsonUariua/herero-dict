/**
 * Environment-free constants and helpers shared by the browser UI and the
 * MCP server. (`settings.ts` adds the React hook on top of this.)
 */

import type { RagSettings } from './types';

export const DEFAULT_SETTINGS: RagSettings = {
  mode: 'auto',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
};

/** Providers people commonly use, offered in the settings dialog. */
export const PROVIDER_PRESETS = [
  { label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
  { label: 'Custom', baseUrl: '', model: '' },
];

/** True when the provider is a local runtime that does not need an API key. */
export function isLocalProvider(baseUrl: string): boolean {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseUrl);
}
