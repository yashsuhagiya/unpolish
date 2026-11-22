export interface FloatingButtonHandlers {
  onClick: () => void;
}

const STYLES = `
  :host { all: initial; }
  .btn {
    pointer-events: auto;
    position: fixed;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, #0ea5e9, #6366f1);
    color: white;
    font: 700 13px/1 system-ui, -apple-system, sans-serif;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    display: none;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    z-index: 2147483647;
  }
  .btn:hover {
    transform: scale(1.06);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  }
  .btn.visible { display: flex; }
`;

export class FloatingButton {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private button: HTMLButtonElement;
  private targetEl: Element | null = null;
  private rafId: number | null = null;
  private scrollHandler: (() => void) | null = null;
  private resizeHandler: (() => void) | null = null;

  constructor(handlers: FloatingButtonHandlers) {
    this.host = document.createElement('div');
    this.host.setAttribute('data-unpolish', 'button');
    this.host.style.cssText =
      'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: 2147483647;';
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = STYLES;
    this.shadow.appendChild(style);

    this.button = document.createElement('button');
    this.button.className = 'btn';
    this.button.title = 'Rewrite with Unpolish';
    this.button.textContent = 'U';
    // mousedown so we don't lose focus on the editable
    this.button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.onClick();
    });
    this.shadow.appendChild(this.button);

    document.documentElement.appendChild(this.host);
  }

  attachTo(el: Element): void {
    this.targetEl = el;
    // Visibility is controlled entirely via inline style in reposition().
    this.reposition();
    this.startTracking();
  }

  detach(): void {
    this.targetEl = null;
    this.button.style.display = 'none';
    this.stopTracking();
  }

  private reposition(): void {
    if (!this.targetEl) return;

    // Target detached from DOM (framework re-rendered) — hide and bail.
    if (!this.targetEl.isConnected) {
      this.button.style.display = 'none';
      return;
    }

    const rect = this.targetEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // Too small to be a useful text field
    if (rect.width < 80 || rect.height < 24) {
      this.button.style.display = 'none';
      return;
    }
    // Too large = almost certainly a wrapper/section, not a text field
    if (rect.height > 800 || (rect.width > 1200 && rect.height > 500)) {
      this.button.style.display = 'none';
      return;
    }
    // Target scrolled out of viewport — hide so the S doesn't get orphaned
    if (rect.bottom <= 0 || rect.top >= vh || rect.right <= 0 || rect.left >= vw) {
      this.button.style.display = 'none';
      return;
    }

    this.button.style.display = 'flex';
    const top = Math.max(4, Math.min(vh - 32, rect.bottom - 34));
    const left = Math.max(4, Math.min(vw - 32, rect.right - 34));
    this.button.style.top = `${top}px`;
    this.button.style.left = `${left}px`;
  }

  private startTracking(): void {
    // Continuous tracking via rAF (covers layout shifts even without events)
    const tick = () => {
      this.reposition();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);

    // Belt-and-suspenders: also reposition on scroll (any scrollable ancestor)
    // and on resize. capture: true catches scrolls inside nested scroll
    // containers, not just the main document.
    this.scrollHandler = () => this.reposition();
    this.resizeHandler = () => this.reposition();
    document.addEventListener('scroll', this.scrollHandler, { capture: true, passive: true });
    window.addEventListener('resize', this.resizeHandler, { passive: true });
  }

  private stopTracking(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.scrollHandler) {
      document.removeEventListener('scroll', this.scrollHandler, { capture: true } as EventListenerOptions);
      this.scrollHandler = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }

  destroy(): void {
    this.stopTracking();
    this.host.remove();
  }
}
