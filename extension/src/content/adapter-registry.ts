import type { Adapter } from './adapters/types';
import { fallbackAdapter } from './adapters/fallback';
import { gmailAdapter } from './adapters/gmail';
import { linkedinAdapter } from './adapters/linkedin';
import { slackAdapter } from './adapters/slack';

const SITE_ADAPTERS: Adapter[] = [gmailAdapter, linkedinAdapter, slackAdapter];

function siteAdapter(): Adapter | null {
  const host = window.location.hostname;
  return SITE_ADAPTERS.find((a) => a.matches(host)) ?? null;
}

export function isEditableTarget(el: Element): boolean {
  const site = siteAdapter();
  if (site && site.isTarget(el)) return true;
  return fallbackAdapter.isTarget(el);
}

export function getActiveAdapter(el: Element): Adapter {
  const site = siteAdapter();
  if (site && site.isTarget(el)) return site;
  return fallbackAdapter;
}
