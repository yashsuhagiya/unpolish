import { isEditableTarget, getActiveAdapter } from './adapter-registry';
import { FloatingButton } from './ui/floating-button';
import { PreviewPanel } from './ui/preview-panel';
import { loadSettings } from '../shared/storage';
import type { HumanifyResponse, Mode } from '../shared/messages';

let currentTarget: Element | null = null;
let currentMode: Mode = 'casual';
let button: FloatingButton | null = null;
let panel: PreviewPanel | null = null;

function ensureButton(): FloatingButton {
  if (!button) {
    button = new FloatingButton({ onClick: handleHumanifyClick });
  }
  return button;
}

function destroyPanel(): void {
  panel?.destroy();
  panel = null;
}

function findEditableInPath(path: EventTarget[]): Element | null {
  for (const node of path) {
    if (node instanceof Element && isEditableTarget(node)) return node;
  }
  return null;
}

document.addEventListener(
  'focusin',
  (e) => {
    const editable = findEditableInPath(e.composedPath());
    if (editable) {
      currentTarget = editable;
      ensureButton().attachTo(editable);
    }
  },
  true
);

document.addEventListener(
  'focusout',
  () => {
    // Delay so a button mousedown re-focusing the editable doesn't drop the button.
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || !isEditableTarget(active)) {
        button?.detach();
      }
    }, 120);
  },
  true
);

// Some sites swallow focus changes (clicks on labels, buttons that preventDefault, etc.),
// so focusout doesn't always fire. Mirror the dismiss with an outside-click handler.
document.addEventListener(
  'pointerdown',
  (e) => {
    if (!currentTarget) return;
    const path = e.composedPath();

    // Click landed inside our own UI (button or panel host) — let it through.
    for (const node of path) {
      if (node instanceof Element && node.getAttribute?.('data-unpolish')) return;
    }

    // Click landed inside the focused editable — stay attached.
    if (path.includes(currentTarget)) return;

    // Click landed inside another editable — focusin will re-attach to it; we can hide for now.
    // Click landed on something non-editable — hide for good.
    button?.detach();
  },
  true
);

async function handleHumanifyClick(): Promise<void> {
  if (!currentTarget) return;
  const adapter = getActiveAdapter(currentTarget);
  const text = adapter.getText(currentTarget).trim();
  if (!text) return;

  const settings = await loadSettings();
  currentMode = settings.defaultMode;

  destroyPanel();
  panel = new PreviewPanel(currentMode, {
    onAccept: handleAccept,
    onReject: handleReject,
    onRegenerate: handleRegenerate,
    onModeChange: handleModeChange
  });

  await fetchAndShow(text, currentMode);
}

async function fetchAndShow(text: string, mode: Mode): Promise<void> {
  if (!panel || !currentTarget) return;
  panel.showLoading(text, currentTarget);
  try {
    const resp = (await chrome.runtime.sendMessage({
      type: 'humanify',
      text,
      mode
    })) as HumanifyResponse;

    if (!panel) return; // user closed it mid-flight
    if (resp?.ok) panel.showResult(resp.rewritten);
    else panel.showError(resp?.error ?? 'unknown error');
  } catch (err) {
    panel?.showError(err instanceof Error ? err.message : 'unknown error');
  }
}

function handleAccept(rewritten: string): void {
  if (currentTarget) {
    const adapter = getActiveAdapter(currentTarget);
    adapter.setText(currentTarget, rewritten);
  }
  destroyPanel();
}

function handleReject(): void {
  destroyPanel();
}

async function handleRegenerate(mode: Mode): Promise<void> {
  if (!currentTarget) return;
  const adapter = getActiveAdapter(currentTarget);
  const text = adapter.getText(currentTarget).trim();
  if (!text) return;
  currentMode = mode;
  await fetchAndShow(text, mode);
}

async function handleModeChange(mode: Mode): Promise<void> {
  await handleRegenerate(mode);
}
