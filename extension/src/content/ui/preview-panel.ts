import { diffWords } from 'diff';
import type { Mode } from '../../shared/messages';

export interface PreviewPanelHandlers {
  onAccept: (rewritten: string) => void;
  onReject: () => void;
  onRegenerate: (mode: Mode) => void;
  onModeChange: (mode: Mode) => void;
}

const STYLES = `
  :host { all: initial; }
  .panel {
    position: fixed;
    width: 440px;
    max-width: calc(100vw - 24px);
    max-height: 70vh;
    background: white;
    color: #111;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
    font: 14px/1.5 system-ui, -apple-system, sans-serif;
    display: none;
    flex-direction: column;
    overflow: hidden;
    z-index: 2147483646;
  }
  .panel.visible { display: flex; }
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }
  .title {
    font-weight: 600;
    flex: 1;
    font-size: 13px;
    letter-spacing: 0.2px;
  }
  .mode-toggle {
    display: flex;
    gap: 2px;
    background: #f3f4f6;
    border-radius: 8px;
    padding: 2px;
  }
  .mode-btn {
    border: none;
    background: transparent;
    padding: 5px 10px;
    border-radius: 6px;
    font: 600 12px/1 system-ui, -apple-system, sans-serif;
    cursor: pointer;
    color: #555;
  }
  .mode-btn.active {
    background: white;
    color: #111;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }
  .close {
    border: none;
    background: transparent;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    color: #888;
    padding: 0 4px;
  }
  .close:hover { color: #111; }
  .diff {
    padding: 14px;
    overflow-y: auto;
    flex: 1;
    white-space: pre-wrap;
    word-wrap: break-word;
    background: #fafafa;
    font-size: 14px;
    line-height: 1.55;
  }
  .add {
    background: rgba(34, 197, 94, 0.18);
    border-radius: 2px;
  }
  .del {
    background: rgba(239, 68, 68, 0.15);
    text-decoration: line-through;
    color: #991b1b;
    border-radius: 2px;
  }
  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 10px 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }
  .btn {
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: white;
    color: #111;
    padding: 6px 14px;
    border-radius: 8px;
    font: 600 13px/1 system-ui, -apple-system, sans-serif;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .btn:hover { background: #f9fafb; }
  .btn-primary {
    background: #111;
    color: white;
    border-color: #111;
  }
  .btn-primary:hover { background: #333; }
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px;
    color: #666;
  }
  .spinner {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #e5e7eb;
    border-top-color: #111;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error {
    padding: 16px;
    color: #991b1b;
    background: #fef2f2;
    font-size: 13px;
  }
  @media (prefers-color-scheme: dark) {
    .panel {
      background: #1f2937;
      color: #f9fafb;
      border-color: rgba(255, 255, 255, 0.08);
    }
    .header { border-bottom-color: rgba(255, 255, 255, 0.08); }
    .mode-toggle { background: rgba(0, 0, 0, 0.3); }
    .mode-btn { color: #d1d5db; }
    .mode-btn.active { background: #374151; color: white; }
    .diff { background: #111827; }
    .add { background: rgba(34, 197, 94, 0.28); }
    .del { background: rgba(239, 68, 68, 0.25); color: #fca5a5; }
    .actions { border-top-color: rgba(255, 255, 255, 0.08); }
    .btn {
      background: #374151;
      color: white;
      border-color: rgba(255, 255, 255, 0.08);
    }
    .btn:hover { background: #4b5563; }
    .btn-primary { background: white; color: #111; border-color: white; }
    .btn-primary:hover { background: #f3f4f6; }
    .close { color: #9ca3af; }
    .close:hover { color: white; }
    .loading { color: #d1d5db; }
    .error { background: #450a0a; color: #fca5a5; }
  }
`;

export class PreviewPanel {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private container: HTMLDivElement;
  private mode: Mode;
  private originalText = '';
  private rewrittenText = '';

  constructor(initialMode: Mode, private handlers: PreviewPanelHandlers) {
    this.mode = initialMode;

    this.host = document.createElement('div');
    this.host.setAttribute('data-unpolish', 'panel');
    this.host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; z-index: 2147483646;';
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = STYLES;
    this.shadow.appendChild(style);

    this.container = document.createElement('div');
    this.container.className = 'panel';
    this.shadow.appendChild(this.container);

    document.documentElement.appendChild(this.host);
  }

  showLoading(originalText: string, anchor: Element): void {
    this.originalText = originalText;
    this.rewrittenText = '';
    this.position(anchor);

    this.clearContainer();
    this.container.appendChild(this.buildHeader({ withModeToggle: false }));

    const loading = document.createElement('div');
    loading.className = 'loading';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const label = document.createElement('div');
    label.textContent = 'Rewriting…';
    loading.append(spinner, label);
    this.container.appendChild(loading);

    this.container.classList.add('visible');
  }

  showError(message: string): void {
    this.clearContainer();
    this.container.appendChild(this.buildHeader({ withModeToggle: false }));

    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = message;
    this.container.appendChild(error);

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.appendChild(this.makeButton('Close', 'btn', () => this.handlers.onReject()));
    this.container.appendChild(actions);
  }

  showResult(rewritten: string): void {
    this.rewrittenText = rewritten;

    this.clearContainer();
    this.container.appendChild(this.buildHeader({ withModeToggle: true }));

    const diff = document.createElement('div');
    diff.className = 'diff';
    appendDiffNodes(diff, this.originalText, rewritten);
    this.container.appendChild(diff);

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.appendChild(this.makeButton('Regenerate', 'btn', () => this.handlers.onRegenerate(this.mode)));
    actions.appendChild(this.makeButton('Reject', 'btn', () => this.handlers.onReject()));
    actions.appendChild(this.makeButton('Accept', 'btn btn-primary', () => this.handlers.onAccept(this.rewrittenText)));
    this.container.appendChild(actions);
  }

  hide(): void {
    this.container.classList.remove('visible');
  }

  destroy(): void {
    this.host.remove();
  }

  private clearContainer(): void {
    while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
  }

  private buildHeader(opts: { withModeToggle: boolean }): HTMLElement {
    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Unpolish';
    header.appendChild(title);

    if (opts.withModeToggle) {
      const toggle = document.createElement('div');
      toggle.className = 'mode-toggle';
      toggle.appendChild(this.makeModeButton('casual', 'Casual'));
      toggle.appendChild(this.makeModeButton('professional', 'Professional'));
      header.appendChild(toggle);
    }

    const close = document.createElement('button');
    close.className = 'close';
    close.title = 'Close';
    close.textContent = '×';
    close.addEventListener('click', (e) => {
      e.preventDefault();
      this.handlers.onReject();
    });
    header.appendChild(close);

    return header;
  }

  private makeModeButton(mode: Mode, label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'mode-btn' + (mode === this.mode ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (mode !== this.mode) {
        this.mode = mode;
        this.handlers.onModeChange(mode);
      }
    });
    return btn;
  }

  private makeButton(label: string, className: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });
    return btn;
  }

  private position(anchor: Element): void {
    const rect = anchor.getBoundingClientRect();
    const panelWidth = 440;
    const panelHeight = 320;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.bottom + margin;
    let left = rect.left;

    if (top + panelHeight > vh) {
      top = Math.max(margin, rect.top - panelHeight - margin);
    }
    if (left + panelWidth > vw) {
      left = Math.max(margin, vw - panelWidth - margin);
    }
    if (left < margin) left = margin;

    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;
  }
}

function appendDiffNodes(parent: HTMLElement, a: string, b: string): void {
  const parts = diffWords(a, b);
  for (const p of parts) {
    if (p.added) {
      const span = document.createElement('span');
      span.className = 'add';
      span.textContent = p.value;
      parent.appendChild(span);
    } else if (p.removed) {
      const span = document.createElement('span');
      span.className = 'del';
      span.textContent = p.value;
      parent.appendChild(span);
    } else {
      parent.appendChild(document.createTextNode(p.value));
    }
  }
}
