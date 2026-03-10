# HomeExchange MCP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local MCP server that exposes HomeExchange search/discovery and messaging as tools, using a Playwright-based login flow to capture and persist the auth session.

**Architecture:** `login.ts` opens a headless Chromium browser, intercepts the auth token once it appears in a real API request, saves it to `session.json`, then exits. `api.ts` loads that session and wraps `fetch` with the right `Authorization` and `Cookie` headers. `mcp.ts` wires up an MCP `Server` (stdio transport) that registers tools from `tools/search.ts` and `tools/messaging.ts`.

**Tech Stack:** TypeScript, Playwright (auth capture), `@modelcontextprotocol/sdk@1.27.1`, Node.js `fetch` (built-in, Node 18+)

---

## Task 1: Install MCP SDK and add scripts

**Files:**
- Modify: `package.json`

**Step 1: Install the SDK**

```bash
cd /Users/mcwm/Code/homeexchange
npm install @modelcontextprotocol/sdk@1.27.1
```

Expected: `package.json` and `package-lock.json` updated with `@modelcontextprotocol/sdk`.

**Step 2: Add scripts to `package.json`**

Add to the `"scripts"` block:

```json
"login": "ts-node src/login.ts",
"mcp":   "ts-node src/mcp.ts"
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @modelcontextprotocol/sdk and mcp/login scripts"
```

---

## Task 2: `src/login.ts` — browser auth capture

**Files:**
- Create: `src/login.ts`

The goal is a minimal, focused script. Open Chromium, navigate to homeexchange.com, intercept the first real `Authorization` header (ignoring `Bearer undefined`), save `{ token, cookies, userId }` to `session.json`, close browser.

**Step 1: Write `src/login.ts`**

```typescript
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_PATH = path.resolve(__dirname, '../session.json');

async function login() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  let token: string | null = null;
  let userId: string | null = null;

  console.log('\n🔐 HomeExchange Login\n');
  console.log('   Log in to your account, then press Ctrl+C (or close the browser).\n');

  page.on('request', (req) => {
    const url = req.url();
    if (!url.includes('homeexchange.com')) return;

    const auth = req.headers()['authorization'];
    if (auth && auth !== 'Bearer undefined' && !token) {
      token = auth;
      console.log('✅ Auth token captured.');
    }

    if (!userId) {
      const match = url.match(/\/(?:users|members)\/(\d+)/);
      if (match?.[1]) {
        userId = match[1];
        console.log(`✅ User ID: ${userId}`);
      }
    }
  });

  const save = async () => {
    const cookies = await ctx.cookies();
    const session = { token, cookies, userId };
    fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2));
    console.log(`\n💾 Session saved to session.json`);
    console.log(`   Token:   ${token ? token.slice(0, 40) + '...' : 'none'}`);
    console.log(`   Cookies: ${cookies.length}`);
    console.log(`   User ID: ${userId ?? 'unknown'}`);
    console.log('\n   Run: npm run mcp\n');
    await browser.close();
    process.exit(0);
  };

  process.on('SIGINT', () => { void save(); });
  browser.on('disconnected', () => { void save(); });

  await page.goto('https://www.homeexchange.com');
  await new Promise<void>(() => {}); // keep alive until signal
}

login().catch(console.error);
```

**Step 2: Verify it runs**

```bash
npm run login
```

Expected: browser opens, log in, Ctrl+C → `session.json` updated with real token.

**Step 3: Commit**

```bash
git add src/login.ts
git commit -m "feat: add login.ts for focused auth session capture"
```

---

## Task 3: `src/api.ts` — authenticated HTTP client

**Files:**
- Create: `src/api.ts`

Loads `session.json` once at startup. Exposes `get(path, params?)` and `post(path, body?)` targeting both `api.homeexchange.com` and `bff.homeexchange.com`. Throws a clear error on 401 so callers know to re-login.

**Step 1: Write `src/api.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';

const SESSION_PATH = path.resolve(__dirname, '../session.json');

interface Session {
  token: string | null;
  cookies: { name: string; value: string; domain: string }[];
  userId: string | null;
}

function loadSession(): Session {
  if (!fs.existsSync(SESSION_PATH)) {
    throw new Error('No session found. Run: npm run login');
  }
  return JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8')) as Session;
}

const session = loadSession();

export const userId = session.userId;

function cookieHeader(): string {
  return session.cookies
    .filter((c) => c.domain?.includes('homeexchange.com'))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

function baseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(session.token ? { Authorization: session.token } : {}),
    Cookie: cookieHeader(),
  };
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...baseHeaders(), ...(init.headers as Record<string, string> ?? {}) },
  });

  if (res.status === 401) {
    throw new Error('Session expired. Run: npm run login');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export const api = {
  // BFF (search, conversations, homes)
  bff<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`https://bff.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request<T>(url.toString());
  },

  bffPost<T>(endpoint: string, body: unknown, params?: Record<string, string>): Promise<T> {
    const url = new URL(`https://bff.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request<T>(url.toString(), { method: 'POST', body: JSON.stringify(body) });
  },

  // Core API
  get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`https://api.homeexchange.com${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return request<T>(url.toString());
  },

  post<T>(endpoint: string, body: unknown): Promise<T> {
    return request<T>(`https://api.homeexchange.com${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
```

**Step 2: Commit**

```bash
git add src/api.ts
git commit -m "feat: add api.ts authenticated HTTP client"
```

---

## Task 4: `src/tools/search.ts` — search & discovery tools

**Files:**
- Create: `src/tools/search.ts`

Covers every useful search/discovery operation visible in the recorded session.

**Tool inventory:**

| Tool | Endpoint | Notes |
|------|----------|-------|
| `search_homes` | `POST /search/homes` | Main search with all filters |
| `get_home` | `GET /bff/homes/{id}` | Home detail page data |
| `get_home_calendar` | `GET /v1/homes/{id}/calendar` | Availability (see Roadmap) |
| `get_recommendations` | `POST /search/recommendation` | Personalised picks |
| `list_my_homes` | `GET /v1/homes/me` | Your own listings |
| `list_favorites` | `GET /v2/favorites/me` | Saved homes |
| `add_favorite` | `POST /v2/favorites` | Save a home |
| `remove_favorite` | `DELETE /v2/favorites/{homeId}` | Unsave a home |
| `list_saved_searches` | `GET /search/saved-searches` | Your saved filters |
| `get_user_profile` | `GET /users/{userId}` | Another member's public profile |

**Step 1: Write `src/tools/search.ts`**

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { api, userId } from '../api.js';

export const searchTools: Tool[] = [
  {
    name: 'search_homes',
    description: 'Search HomeExchange homes by location, dates, guests, and exchange type.',
    inputSchema: {
      type: 'object',
      properties: {
        location:      { type: 'string', description: 'City, region, or country name' },
        checkin:       { type: 'string', description: 'ISO date YYYY-MM-DD' },
        checkout:      { type: 'string', description: 'ISO date YYYY-MM-DD' },
        guests:        { type: 'number', description: 'Number of guests' },
        exchange_type: { type: 'string', enum: ['GuestPoints', 'simultaneous', 'non_simultaneous'], description: 'Type of exchange' },
        home_type:     { type: 'string', enum: ['house', 'apartment', 'other'], description: 'Property type' },
        limit:         { type: 'number', description: 'Results per page (default 20, max 36)' },
        offset:        { type: 'number', description: 'Pagination offset' },
      },
    },
  },
  {
    name: 'get_home',
    description: 'Get full details for a HomeExchange listing by home ID.',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Numeric home ID' },
      },
    },
  },
  {
    name: 'get_home_calendar',
    description: 'Get availability calendar for a home (blocked/available dates).',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Numeric home ID' },
      },
    },
  },
  {
    name: 'get_recommendations',
    description: 'Get personalised home recommendations based on your profile and history.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of recommendations (default 8)' },
      },
    },
  },
  {
    name: 'list_my_homes',
    description: 'List your own HomeExchange listings.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_favorites',
    description: 'List your saved favourite homes.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of results (default 20)' },
      },
    },
  },
  {
    name: 'add_favorite',
    description: 'Save a home to your favourites.',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Home ID to save' },
      },
    },
  },
  {
    name: 'remove_favorite',
    description: 'Remove a home from your favourites.',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Home ID to remove' },
      },
    },
  },
  {
    name: 'list_saved_searches',
    description: 'List your saved search filters.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of results (default 100)' },
      },
    },
  },
  {
    name: 'get_user_profile',
    description: "Get a member's public profile page.",
    inputSchema: {
      type: 'object',
      required: ['user_id'],
      properties: {
        user_id: { type: 'string', description: 'Numeric user ID' },
      },
    },
  },
];

type Args = Record<string, unknown>;

export async function handleSearch(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'search_homes': {
      const body: Record<string, unknown> = {};
      if (args['location'])      body['location']     = args['location'];
      if (args['checkin'])       body['dateFrom']      = args['checkin'];
      if (args['checkout'])      body['dateTo']        = args['checkout'];
      if (args['guests'])        body['nbGuests']      = args['guests'];
      if (args['exchange_type']) body['exchangeTypes'] = [args['exchange_type']];
      if (args['home_type'])     body['homeTypes']     = [args['home_type']];
      const limit  = (args['limit']  as number | undefined) ?? 20;
      const offset = (args['offset'] as number | undefined) ?? 0;
      return api.bffPost(`/search/homes`, body, {
        limit: String(limit),
        offset: String(offset),
      });
    }

    case 'get_home':
      return api.bff(`/homes/${args['home_id'] as string}`);

    case 'get_home_calendar':
      return api.get(`/v1/homes/${args['home_id'] as string}/calendar`);

    case 'get_recommendations': {
      const limit = (args['limit'] as number | undefined) ?? 8;
      return api.bffPost('/search/recommendation', {}, { limit: String(limit) });
    }

    case 'list_my_homes':
      return api.bff('/v1/homes/me');

    case 'list_favorites': {
      const limit = (args['limit'] as number | undefined) ?? 20;
      return api.get('/v2/favorites/me', {
        'filters[status]': '1',
        'order_by[createdAt]': 'DESC',
        limit: String(limit),
      });
    }

    case 'add_favorite':
      return api.post('/v2/favorites', { homeId: args['home_id'] });

    case 'remove_favorite':
      return fetch(`https://api.homeexchange.com/v2/favorites/${args['home_id'] as string}`, {
        method: 'DELETE',
        headers: { Authorization: (await import('../api.js')).userId ?? '' },
      });

    case 'list_saved_searches': {
      const limit = (args['limit'] as number | undefined) ?? 100;
      return api.bff('/search/saved-searches', { limit: String(limit) });
    }

    case 'get_user_profile':
      return api.bff(`/users/${args['user_id'] as string}`);

    default:
      throw new Error(`Unknown search tool: ${name}`);
  }
}
```

> **Note on `remove_favorite`:** The DELETE handler needs to use the full authenticated headers from `api.ts` — refactor to expose a `del()` method on `api` if needed (see Task 3 refinement).

**Step 2: Commit**

```bash
git add src/tools/search.ts
git commit -m "feat: add search and discovery MCP tools"
```

---

## Task 5: `src/tools/messaging.ts` — messaging tools

**Files:**
- Create: `src/tools/messaging.ts`

**Tool inventory:**

| Tool | Endpoint | Notes |
|------|----------|-------|
| `list_conversations` | `GET /v3/conversations/me` | Filter: ALL, UNANSWERED, ARCHIVED |
| `get_conversation` | `GET /v3/conversations/{id}` | Messages in a thread |
| `send_message` | `POST /v3/conversations/{id}/messages` | Send text to a thread |
| `start_conversation` | `POST /v3/conversations` | Open new thread with a member |

**Step 1: Write `src/tools/messaging.ts`**

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { api } from '../api.js';

export const messagingTools: Tool[] = [
  {
    name: 'list_conversations',
    description: 'List your HomeExchange conversations.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['ALL', 'UNANSWERED', 'ARCHIVED'],
          description: 'Filter conversations (default ALL)',
        },
        limit: { type: 'number', description: 'Number to return (default 20)' },
        after:  { type: 'string', description: 'Cursor for pagination' },
      },
    },
  },
  {
    name: 'get_conversation',
    description: 'Get all messages in a conversation thread.',
    inputSchema: {
      type: 'object',
      required: ['conversation_id'],
      properties: {
        conversation_id: { type: 'string', description: 'Conversation ID' },
      },
    },
  },
  {
    name: 'send_message',
    description: 'Send a message in an existing conversation.',
    inputSchema: {
      type: 'object',
      required: ['conversation_id', 'text'],
      properties: {
        conversation_id: { type: 'string', description: 'Conversation ID' },
        text: { type: 'string', description: 'Message text to send' },
      },
    },
  },
  {
    name: 'start_conversation',
    description: 'Start a new conversation with a member about their home.',
    inputSchema: {
      type: 'object',
      required: ['home_id', 'text'],
      properties: {
        home_id: { type: 'string', description: 'The home you are enquiring about' },
        text:    { type: 'string', description: 'Opening message' },
      },
    },
  },
];

type Args = Record<string, unknown>;

export async function handleMessaging(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'list_conversations': {
      const filter = (args['filter'] as string | undefined) ?? 'ALL';
      const limit  = (args['limit']  as number | undefined) ?? 20;
      const after  = (args['after']  as string | undefined) ?? '0';
      return api.bff('/v3/conversations/me', {
        filter,
        first: String(limit),
        after,
      });
    }

    case 'get_conversation':
      return api.bff(`/v3/conversations/${args['conversation_id'] as string}`);

    case 'send_message':
      return api.bffPost(
        `/v3/conversations/${args['conversation_id'] as string}/messages`,
        { text: args['text'] }
      );

    case 'start_conversation':
      return api.bffPost('/v3/conversations', {
        homeId: args['home_id'],
        message: { text: args['text'] },
      });

    default:
      throw new Error(`Unknown messaging tool: ${name}`);
  }
}
```

**Step 2: Commit**

```bash
git add src/tools/messaging.ts
git commit -m "feat: add messaging MCP tools"
```

---

## Task 6: `src/mcp.ts` — MCP server

**Files:**
- Create: `src/mcp.ts`

Wires up all tools to an MCP `Server` with stdio transport. Handles `tools/list` and `tools/call`.

**Step 1: Write `src/mcp.ts`**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { searchTools, handleSearch } from './tools/search.js';
import { messagingTools, handleMessaging } from './tools/messaging.js';

const ALL_TOOLS = [...searchTools, ...messagingTools];
const SEARCH_NAMES  = new Set(searchTools.map((t) => t.name));
const MESSAGING_NAMES = new Set(messagingTools.map((t) => t.name));

const server = new Server(
  { name: 'homeexchange', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    let result: unknown;

    if (SEARCH_NAMES.has(name)) {
      result = await handleSearch(name, args as Record<string, unknown>);
    } else if (MESSAGING_NAMES.has(name)) {
      result = await handleMessaging(name, args as Record<string, unknown>);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is reserved for MCP protocol
  process.stderr.write('HomeExchange MCP server running (stdio)\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(1);
});
```

**Step 2: Verify typecheck passes**

```bash
npm run check
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/mcp.ts
git commit -m "feat: add MCP server entrypoint wiring all tools"
```

---

## Task 7: Refine `api.ts` — add `del()` method

**Files:**
- Modify: `src/api.ts`

Add a `del()` method to the `api` object so `remove_favorite` (and any future DELETE calls) can use the shared auth headers cleanly.

**Step 1: Add `del()` to `api.ts`**

Add to the `api` object:

```typescript
del<T>(endpoint: string): Promise<T> {
  return request<T>(`https://api.homeexchange.com${endpoint}`, { method: 'DELETE' });
},
```

**Step 2: Update `remove_favorite` in `search.ts`** to use `api.del`:

```typescript
case 'remove_favorite':
  return api.del(`/v2/favorites/${args['home_id'] as string}`);
```

Remove the raw `fetch` call and `import('../api.js')` in that case.

**Step 3: Commit**

```bash
git add src/api.ts src/tools/search.ts
git commit -m "fix: use api.del() for remove_favorite instead of raw fetch"
```

---

## Task 8: Update README

**Files:**
- Modify: `README.md`

Update the README to reflect the real implementation:

1. Update the Claude Code config snippet — use `ts-node` directly:
```json
{
  "mcpServers": {
    "homeexchange": {
      "command": "npx",
      "args": ["ts-node", "src/mcp.ts"],
      "cwd": "/path/to/homeexchange"
    }
  }
}
```

2. Confirm the tool table matches the implemented tools (Tasks 4–5).

3. Update the project layout to include `src/login.ts`, `src/api.ts`, `src/tools/search.ts`, `src/tools/messaging.ts`, `src/mcp.ts`.

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README to match implemented MCP"
```

---

## Final verification

```bash
# Check everything compiles cleanly
npm run check

# Start MCP server and confirm it prints startup message to stderr
npm run mcp 2>&1 | head -2
```

Expected:
```
HomeExchange MCP server running (stdio)
```
