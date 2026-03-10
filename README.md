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

Auth is captured once via browser automation. The MCP server runs locally over stdio and makes direct authenticated API calls — no browser needed at runtime. Works with any MCP-compatible client.

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

---

## MCP client setup

The server uses **stdio transport** — the standard used by all major MCP clients. Add it to whichever client you use:

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Claude Code

```bash
claude mcp add homeexchange -- npx ts-node src/mcp.ts
```

Or in `.claude/mcp.json`:

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

### Cursor

`~/.cursor/mcp.json`:

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

### Zed

`.zed/settings.json`:

```json
{
  "context_servers": {
    "homeexchange": {
      "command": {
        "path": "npx",
        "args": ["ts-node", "src/mcp.ts"],
        "env": {}
      }
    }
  }
}
```

### Other clients

Any client that supports MCP stdio transport works. Point it at:

```
command: npx ts-node src/mcp.ts
cwd:     /path/to/homeexchange
```

---

## MCP tools

### Search & discovery

#### `search_homes`

Search HomeExchange listings by location, dates, guests, and exchange type.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `location` | string | No | — | City, region, or country name |
| `checkin` | string | No | — | Check-in date (`YYYY-MM-DD`) |
| `checkout` | string | No | — | Check-out date (`YYYY-MM-DD`) |
| `guests` | number | No | — | Number of guests |
| `exchange_type` | string | No | — | `GuestPoints` · `simultaneous` · `non_simultaneous` |
| `home_type` | string | No | — | `house` · `apartment` · `other` |
| `limit` | number | No | `20` | Results per page (max 36) |
| `offset` | number | No | `0` | Pagination offset |

#### `get_home`

Get full details for a listing by ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Numeric home ID |

#### `get_home_calendar`

Get availability calendar for a home showing blocked and open dates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Numeric home ID |

#### `get_recommendations`

Get personalised home picks based on your profile and history.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `8` | Number of recommendations |

#### `list_my_homes`

List your own HomeExchange listings. No parameters.

#### `list_favorites`

List your saved favourite homes.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `20` | Number of results |

#### `add_favorite`

Save a home to your favourites.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Home ID to save |

#### `remove_favorite`

Remove a home from your favourites.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Home ID to remove |

#### `list_saved_searches`

List your saved search filters.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `100` | Number of results |

#### `get_user_profile`

Get a member's public profile.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | **Yes** | Numeric user ID |

---

### Messaging

#### `list_conversations`

List your HomeExchange conversation threads.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filter` | string | No | `ALL` | `ALL` · `UNANSWERED` · `ARCHIVED` |
| `limit` | number | No | `20` | Number of threads to return |
| `after` | string | No | — | Pagination cursor from a previous response |

#### `get_conversation`

Get all messages in a conversation thread.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | **Yes** | Conversation ID |

#### `send_message`

Send a message in an existing conversation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | **Yes** | Conversation ID |
| `text` | string | **Yes** | Message text |

#### `start_conversation`

Open a new conversation with a member about their home.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | The home you are enquiring about |
| `text` | string | **Yes** | Opening message |

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
