import type { HumanifyRequest, HumanifyResponse } from './shared/messages';
import { loadSettings } from './shared/storage';

chrome.runtime.onMessage.addListener(
  (msg: HumanifyRequest, _sender, sendResponse: (r: HumanifyResponse) => void) => {
    if (msg?.type !== 'humanify') return false;

    handleHumanify(msg)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : 'unknown error'
        })
      );

    return true; // keep the channel open for the async response
  }
);

chrome.action?.onClicked?.addListener(() => {
  chrome.runtime.openOptionsPage();
});

function isLocalUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function handleHumanify(msg: HumanifyRequest): Promise<HumanifyResponse> {
  const { endpoint, fallbackEndpoint, secret } = await loadSettings();

  const targets = [endpoint, fallbackEndpoint]
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => u.replace(/\/+$/, ''));

  if (targets.length === 0) {
    return { ok: false, error: 'Set the backend URL in extension options.' };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const body = JSON.stringify({ text: msg.text, mode: msg.mode });

  let lastError = '';

  for (let i = 0; i < targets.length; i++) {
    const base = targets[i];
    const url = base + '/api/humanify';
    const isLast = i === targets.length - 1;
    const timeoutMs = isLocalUrl(base) ? 3000 : 30000;

    let resp: Response;
    try {
      resp = await fetchWithTimeout(url, { method: 'POST', headers, body }, timeoutMs);
    } catch (err) {
      // Network error / timeout — try next endpoint if any.
      lastError = `${base}: ${err instanceof Error ? err.message : 'network error'}`;
      continue;
    }

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      lastError = `${base}: HTTP ${resp.status} ${errBody.slice(0, 200)}`;
      // Server is reachable but said no. Only fall through on 5xx (transient).
      if (resp.status >= 500 && !isLast) continue;
      return { ok: false, error: lastError };
    }

    const data = (await resp.json().catch(() => null)) as { rewritten?: unknown } | null;
    if (!data || typeof data.rewritten !== 'string') {
      lastError = `${base}: invalid response`;
      if (!isLast) continue;
      return { ok: false, error: lastError };
    }

    return { ok: true, rewritten: data.rewritten };
  }

  return { ok: false, error: `All endpoints failed. ${lastError}` };
}
