import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { SYSTEM_PROMPTS, MODEL, type Mode } from './lib/prompts.js';

const PORT = Number(process.env.PORT ?? 3939);
const SHARED_SECRET = (process.env.SHARED_SECRET ?? '').trim();

if (!SHARED_SECRET) {
  console.error('SHARED_SECRET is required; set it in backend/.env.local');
  process.exit(1);
}

function isAuthorized(header: string): boolean {
  const expected = Buffer.from(`Bearer ${SHARED_SECRET}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const EXTENSION_ORIGIN_PREFIX = 'chrome-extension://';

const app = new Hono();

// Web pages always send Origin on cross-origin requests; only the extension may call this.
app.use('/*', async (c, next) => {
  const origin = c.req.header('origin');
  if (origin && !origin.startsWith(EXTENSION_ORIGIN_PREFIX)) {
    return c.json({ error: 'forbidden origin' }, 403);
  }
  await next();
});

app.use(
  '/*',
  cors({
    origin: (origin) => (origin.startsWith(EXTENSION_ORIGIN_PREFIX) ? origin : null),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
  })
);

app.get('/', (c) =>
  c.text(
    `Unpolish local backend\n\nPOST /api/humanify  body: { text, mode: "casual" | "professional" }\nAuth: Authorization: Bearer <SHARED_SECRET>\nModel: ${MODEL}\n`
  )
);

app.post('/api/humanify', async (c) => {
  if (!isAuthorized(c.req.header('authorization') ?? '')) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  let body: { text?: unknown; mode?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }

  const text = body.text;
  const mode = body.mode as Mode | undefined;

  if (typeof text !== 'string' || text.trim().length === 0) {
    return c.json({ error: 'text required' }, 400);
  }
  if (mode !== 'casual' && mode !== 'professional') {
    return c.json({ error: 'mode must be casual or professional' }, 400);
  }
  if (text.length > 5000) {
    return c.json({ error: 'text too long (max 5000 chars)' }, 400);
  }

  try {
    const stream = query({
      prompt: text,
      options: {
        model: MODEL,
        systemPrompt: SYSTEM_PROMPTS[mode],
        maxTurns: 1,
        tools: [],
        permissionMode: 'dontAsk'
      }
    });

    let rewritten = '';
    for await (const msg of stream) {
      if (msg.type === 'result') {
        if (msg.subtype === 'success') {
          rewritten = (msg.result ?? '').trim();
        } else {
          return c.json({ error: `rewrite failed: ${msg.subtype ?? 'unknown'}` }, 502);
        }
        break;
      }
    }

    if (!rewritten) {
      return c.json({ error: 'empty response from model' }, 502);
    }

    return c.json({ rewritten });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return c.json({ error: message }, 502);
  }
});

console.log(`\nUnpolish local backend listening on http://localhost:${PORT}`);
console.log(`  Model: ${MODEL}`);
console.log(`  Auth:  shared secret required`);
console.log(`  Auth source: ${process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY' : 'Claude Code login'}`);
console.log(`\nPoint the extension at http://localhost:${PORT}\n`);

serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' });
