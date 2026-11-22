import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPTS, MODEL, type Mode } from '../lib/prompts.js';

const SHARED_SECRET = (process.env.SHARED_SECRET ?? '').trim();

function isAuthorized(header: string): boolean {
  const expected = Buffer.from(`Bearer ${SHARED_SECRET}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  if (!SHARED_SECRET) {
    res.status(500).json({ error: 'server misconfigured: SHARED_SECRET missing' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'server misconfigured: ANTHROPIC_API_KEY missing' });
    return;
  }
  if (!isAuthorized((req.headers.authorization ?? '').toString())) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const body = req.body as { text?: unknown; mode?: unknown } | undefined;
  const text = body?.text;
  const mode = body?.mode as Mode | undefined;

  if (typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'text required' });
    return;
  }
  if (mode !== 'casual' && mode !== 'professional') {
    res.status(400).json({ error: 'mode must be casual or professional' });
    return;
  }
  if (text.length > 5000) {
    res.status(400).json({ error: 'text too long (max 5000 chars)' });
    return;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const result = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPTS[mode],
      messages: [{ role: 'user', content: text }]
    });

    const rewritten = result.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim();

    if (!rewritten) {
      res.status(502).json({ error: 'empty response from API' });
      return;
    }

    res.status(200).json({ rewritten });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'upstream error' });
  }
}
