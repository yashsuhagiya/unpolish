import type { Adapter } from './types';

const ALLOWED_INPUT_TYPES = new Set(['text', 'email', 'url', 'search']);

// Inputs whose label/placeholder/aria-label suggest structured data, not prose.
// English + German because many German sites mix the two.
const STRUCTURED_LABEL_PATTERN =
  /\b(date|birth|birthday|dob|time|day|month|year|phone|tel|fax|zip|postal|country code|amount|sum|price|currency|iban|bic|tax|nummer|datum|geburt|geburtstag|zeit|tag|monat|jahr|telefon|plz|betrag|menge|preis|steuer)\b/i;

// Date-shaped current values: "01.02.1990", "07/13/2000", "2000-07-13", etc.
const DATE_VALUE_PATTERN = /^\s*\d{1,4}[.\-\/]\d{1,2}[.\-\/]\d{1,4}\s*$/;

// ARIA roles that look editable but aren't text inputs.
const NON_TEXT_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'listbox',
  'menu',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'treeitem'
]);

export const fallbackAdapter: Adapter = {
  matches: () => true,

  isTarget(el: Element): boolean {
    if (el instanceof HTMLTextAreaElement) {
      return !el.readOnly && !el.disabled;
    }

    if (el instanceof HTMLInputElement) {
      if (!ALLOWED_INPUT_TYPES.has(el.type.toLowerCase())) return false;
      if (el.readOnly || el.disabled) return false;

      // inputmode hints at structured-data entry — skip everything except plain text/search
      const inputMode = el.getAttribute('inputmode')?.toLowerCase();
      if (inputMode && inputMode !== 'text' && inputMode !== 'search') return false;

      // pattern attribute = structured input (date, code, etc.)
      if (el.pattern) return false;

      // Short maxlength = code/postal/etc., not prose
      if (el.maxLength > 0 && el.maxLength < 30) return false;

      // Label / placeholder hints at structured data — read everything we can:
      // aria-label, placeholder, associated <label> elements, aria-labelledby targets.
      if (STRUCTURED_LABEL_PATTERN.test(getInputLabelText(el))) return false;

      // Date-shaped current value
      if (el.value && DATE_VALUE_PATTERN.test(el.value)) return false;

      // Parent looks like a datepicker / combobox / autocomplete widget
      const widgetParent = el.closest(
        '[class*="date" i], [class*="picker" i], [class*="calendar" i], [class*="combobox" i], [class*="autocomplete" i], [data-datepicker], [data-date-picker], [role="combobox"]'
      );
      if (widgetParent) return false;

      // Combobox-style autocomplete inputs
      if (el.getAttribute('role') === 'combobox') return false;
      if (el.getAttribute('aria-haspopup')) return false;

      return true;
    }

    if (el instanceof HTMLElement && el.isContentEditable) {
      // Wrapper guard: if this contenteditable contains another editable, don't
      // attach to the wrapper — wait for focus on the inner element.
      const inner = el.querySelector(
        'input:not([readonly]):not([disabled]):not([type="hidden"]), textarea:not([readonly]):not([disabled]), [contenteditable="true"]'
      );
      if (inner && inner !== el) return false;

      const role = el.getAttribute('role')?.toLowerCase();
      if (role && NON_TEXT_ROLES.has(role)) return false;
      if (el.getAttribute('aria-haspopup')) return false;
      if (el.getAttribute('aria-readonly') === 'true') return false;

      return true;
    }

    return false;
  },

  getText(el: Element): string {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return el.value;
    }
    if (el instanceof HTMLElement) {
      return el.innerText;
    }
    return '';
  },

  setText(el: Element, text: string): void {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (el instanceof HTMLElement && el.isContentEditable) {
      replaceContentEditableText(el, text);
    }
  }
};

function getInputLabelText(el: HTMLInputElement): string {
  const parts: string[] = [];
  const aria = el.getAttribute('aria-label');
  if (aria) parts.push(aria);
  if (el.placeholder) parts.push(el.placeholder);

  // Native <label for="..."> association
  const labels = el.labels;
  if (labels) {
    for (const label of Array.from(labels)) {
      const text = label.textContent;
      if (text) parts.push(text);
    }
  }

  // aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      if (!id) continue;
      const ref = document.getElementById(id);
      if (ref?.textContent) parts.push(ref.textContent);
    }
  }

  return parts.join(' ');
}

export function replaceContentEditableText(el: HTMLElement, text: string): void {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  // execCommand is deprecated but the only reliable way to insert text into
  // rich-text editors (Gmail, Slack, LinkedIn) without breaking their internal state.
  document.execCommand('insertText', false, text);
}
