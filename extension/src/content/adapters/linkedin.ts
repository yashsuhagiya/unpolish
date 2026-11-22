import type { Adapter } from './types';
import { replaceContentEditableText } from './fallback';

export const linkedinAdapter: Adapter = {
  matches: (host) => host === 'www.linkedin.com' || host === 'linkedin.com',

  isTarget(el: Element): boolean {
    if (!(el instanceof HTMLElement)) return false;
    if (!el.isContentEditable) return false;
    if (el.classList.contains('ql-editor')) return true;
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
