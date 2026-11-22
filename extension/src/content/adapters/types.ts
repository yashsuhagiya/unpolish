export interface Adapter {
  matches(hostname: string): boolean;
  isTarget(el: Element): boolean;
  getText(el: Element): string;
  setText(el: Element, text: string): void;
}
