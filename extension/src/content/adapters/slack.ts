import type { Adapter } from './types';
import { replaceContentEditableText } from './fallback';

export const slackAdapter: Adapter = {
  matches: (host) => host === 'app.slack.com' || host.endsWith('.slack.com'),

  isTarget(el: Element): boolean {
    if (!(el instanceof HTMLElement)) return false;
    if (!el.isContentEditable) return false;
    const dataQa = el.getAttribute('data-qa') ?? '';
    if (dataQa.includes('message_input')) return true;
    if (el.classList.contains('ql-editor')) return true;
    return el.getAttribute('role') === 'textbox';
  },

  getText(el: Element): string {
    return (el as HTMLElement).innerText;
  },

  setText(el: Element, text: string): void {
    replaceContentEditableText(el as HTMLElement, text);
  }
};
