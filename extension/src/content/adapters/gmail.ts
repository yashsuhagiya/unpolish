import type { Adapter } from './types';
import { replaceContentEditableText } from './fallback';

export const gmailAdapter: Adapter = {
  matches: (host) => host === 'mail.google.com',

  isTarget(el: Element): boolean {
    if (!(el instanceof HTMLElement)) return false;
    if (!el.isContentEditable) return false;
    const aria = el.getAttribute('aria-label') ?? '';
    if (/message body/i.test(aria)) return true;
    if (el.getAttribute('role') === 'textbox') return true;
    return false;
  },

  getText(el: Element): string {
    return (el as HTMLElement).innerText;
  },

  setText(el: Element, text: string): void {
    replaceContentEditableText(el as HTMLElement, text);
  }
};
