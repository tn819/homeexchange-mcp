# homeexchange-mcp

An unofficial, local MCP server for [HomeExchange](https://www.homeexchange.com) — search homes, read conversations, manage favourites, and more, directly from any MCP-compatible AI client.

> **Status:** Personal/experimental. See [disclaimer](#disclaimer) before use.

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

Auth is captured once via browser automation. The MCP server runs locally over stdio and makes direct authenticated API calls using your own session — no browser needed at runtime. Works with any MCP-compatible client.

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

The server uses **stdio transport** — the standard used by all major MCP clients.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "homeexchange": {
      "command": "npx",
      "args": ["ts-node", "src/mcp.ts"],
      "cwd": "/path/to/homeexchange-mcp"
    }
  }
}
```

### Claude Code

```bash
claude mcp add homeexchange -- npx ts-node src/mcp.ts
```

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "homeexchange": {
      "command": "npx",
      "args": ["ts-node", "src/mcp.ts"],
      "cwd": "/path/to/homeexchange-mcp"
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
        "args": ["ts-node", "src/mcp.ts"]
      }
    }
  }
}
```

### Any other stdio-compatible client

```
command: npx ts-node src/mcp.ts
cwd:     /path/to/homeexchange-mcp
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

Get the availability calendar for a home (blocked and open dates).

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
| `npm run login` | Capture auth session via browser (run this first) |
| `npm run mcp` | Start the local MCP server |
| `npm run record` | Full network recording with HAR capture (for API exploration) |
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

- [ ] **Calendar integration** — query/update home availability, check open dates before messaging, surface conflicts across exchange requests
- [ ] **Remote MCP** — hosted endpoint (Railway/Fly.io); requires proper OAuth/session-refresh flow rather than manual capture
- [ ] **Token expiry detection** — auto-prompt to re-run login when a 401 is encountered
- [ ] **Saved search alerts** — poll for new homes matching saved searches

---

## Disclaimer

This project is **unofficial** and has no affiliation with HomeExchange SAS.

- It accesses the HomeExchange platform using your own account credentials, in the same way your browser does
- It is intended for **personal, non-commercial use only** — to make your own home exchange experience smoother
- It is **not for profit** and must not be used to scrape, resell, or commercially exploit HomeExchange data
- Use of this tool is subject to [HomeExchange's Terms of Service](https://www.homeexchange.com/en/page/terms)
- The HomeExchange API is undocumented and unofficial — endpoints may change or break at any time without notice

**The goal is to build something useful for the HomeExchange community, and ideally to partner with HomeExchange directly to do this properly.** If you work at HomeExchange and want to collaborate on an official integration, please open an issue or get in touch.

---

## License

[MIT](LICENSE) — free to use, modify, and share for personal and non-commercial purposes.

HomeExchange® is a registered trademark of HomeExchange SAS. This project is not endorsed by or affiliated with HomeExchange SAS.
