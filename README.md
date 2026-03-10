# HomeExchange MCP

A local MCP server for [HomeExchange](https://www.homeexchange.com) — search homes, manage conversations, and explore the API.

---

## How it works

```
  npm run login
       │
  Browser opens → you log in once
       │
  session.json  (token + cookies, not committed)
       │
  npm run mcp
       │
  MCP Server (local, stdio)
       │
  ┌────┴─────────────────────┐
  │                          │
  search & discovery    messaging
  (10 tools)            (4 tools)
       │                     │
       └────────┬────────────┘
                │
        HomeExchange API
```

Auth is captured once via browser automation. The MCP server runs locally and makes direct authenticated API calls — no browser needed at runtime.

---

## Quick start

### 1. Install

```bash
npm install
npx playwright install chromium
```

### 2. Capture your session

```bash
npm run login
```

A browser opens. Log in to HomeExchange, then press **Ctrl+C**. Your session (token + cookies) is saved to `session.json`.

> Session tokens expire after a few days. Re-run `npm run login` when tools start returning 401s.

### 3. Start the MCP server

```bash
npm run mcp
```

Add to your Claude Code MCP config:

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

---

## MCP tools

### Search & discovery

| Tool | Description |
|------|-------------|
| `search_homes` | Search by location, dates, guests, exchange type, property type |
| `get_home` | Full details for a listing by ID |
| `get_home_calendar` | Availability calendar (blocked/open dates) |
| `get_recommendations` | Personalised home picks |
| `list_my_homes` | Your own listings |
| `list_favorites` | Your saved homes |
| `add_favorite` | Save a home |
| `remove_favorite` | Unsave a home |
| `list_saved_searches` | Your saved search filters |
| `get_user_profile` | Another member's public profile |

### Messaging

| Tool | Description |
|------|-------------|
| `list_conversations` | List threads (ALL / UNANSWERED / ARCHIVED) with cursor pagination |
| `get_conversation` | All messages in a thread |
| `send_message` | Send a message in an existing thread |
| `start_conversation` | Open a new thread about a home |

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run login` | Capture auth session via browser |
| `npm run mcp` | Start the local MCP server |
| `npm run record` | Full network recording with HAR capture |
| `npm run analyze` | Analyze a captured `.har` file into `api-map.json` |
| `npm run build` | Compile TypeScript |
| `npm run check` | Typecheck + lint |

---

## Project layout

```
src/
  login.ts          browser auth capture
  record.ts         full network recorder with HAR output
  analyze.ts        HAR → api-map.json analysis
  api.ts            authenticated HTTP client
  mcp.ts            MCP stdio server
  tools/
    search.ts       10 search & discovery tools
    messaging.ts    4 messaging tools
```

---

## Roadmap

- [ ] **Calendar integration** — query/update availability, check open dates before messaging, surface conflicts across exchange requests
- [ ] **Remote MCP** — hosted endpoint (Railway/Fly.io); requires proper OAuth/session-refresh flow, not manual capture
- [ ] **Token expiry detection** — auto-prompt to re-run login on 401
- [ ] **Saved search alerts** — poll for new homes matching saved searches
