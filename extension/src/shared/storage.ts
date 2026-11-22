import type { Mode } from './messages';

export type Settings = {
  endpoint: string;
  fallbackEndpoint: string;
  secret: string;
  defaultMode: Mode;
};

const DEFAULTS: Settings = {
  endpoint: '',
  fallbackEndpoint: '',
  secret: '',
  defaultMode: 'casual'
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return stored as Settings;
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(settings);
}
