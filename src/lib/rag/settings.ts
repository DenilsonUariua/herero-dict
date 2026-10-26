/**
 * Client-side settings for the translation feature.
 *
 * Two ways to reach a model:
 *   - server proxy  (recommended for public deployments: the key stays on the server)
 *   - BYOK          (the user pastes their own key; stored only in this browser)
 *
 * Keys live in localStorage and are never sent anywhere except the configured
 * provider endpoint.
 */

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, isLocalProvider } from './settings-core';
import type { RagSettings } from './types';

export { DEFAULT_SETTINGS, PROVIDER_PRESETS, isLocalProvider } from './settings-core';

const STORAGE_KEY = 'herero_rag_settings_v1';

export function loadSettings(): RagSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<RagSettings>;
    return {
      mode: parsed.mode ?? DEFAULT_SETTINGS.mode,
      apiKey: parsed.apiKey ?? '',
      baseUrl: parsed.baseUrl || DEFAULT_SETTINGS.baseUrl,
      model: parsed.model || DEFAULT_SETTINGS.model,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: RagSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage full or blocked — the feature still works for this session */
  }
}

export function useRagSettings() {
  const [settings, setSettings] = useState<RagSettings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<RagSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, update, setSettings };
}
