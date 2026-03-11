<div align="center">

# 🏠 homeexchange-mcp

**An unofficial MCP server for [HomeExchange](https://www.homeexchange.com)**

Search homes · Read messages · Manage favourites · All from your AI client

[![Version](https://img.shields.io/github/v/release/tn819/homeexchange-mcp?color=FF6B35&label=version)](https://github.com/tn819/homeexchange-mcp/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-FF6B35)](LICENSE)
[![Unofficial](https://img.shields.io/badge/status-unofficial-grey)](https://github.com/tn819/homeexchange-mcp#disclaimer)

> **Unofficial project.** Not affiliated with or endorsed by HomeExchange SAS.
> Personal use only — see [disclaimer](#disclaimer).

</div>

---

## What you can do

Once connected, ask your AI client things like:

- *"Find homes in Lisbon for 2 guests in July, GuestPoints only"*
- *"Show me my unanswered messages"*
- *"Send a message to conversation 12345 asking about parking"*
- *"What homes have I favourited?"*
- *"Show the availability calendar for home 1950607"*

**14 tools across two categories:**

| Category | Tools |
|----------|-------|
| 🔍 **Search & discovery** | `search_homes` · `get_home` · `get_home_calendar` · `get_recommendations` · `list_my_homes` · `list_favorites` · `add_favorite` · `remove_favorite` · `list_saved_searches` · `get_user_profile` |
| 💬 **Messaging** | `list_conversations` · `get_conversation` · `send_message` · `start_conversation` |

---

## How it works

```
  npm run login
       │
  Browser opens → you log in once
       │
  session.json  (token + cookies, stays local)
       │
  npm run mcp
       │
  MCP Server (local, stdio)
       │
  ┌────┴──────────────────────┐
  │                           │
  search & discovery     messaging
  (10 tools)             (4 tools)
       │                      │
       └─────────┬────────────┘
                 │
     api.homeexchange.com
     bff.homeexchange.com
```

Auth is captured once via your real browser session — no credentials stored in code. The MCP server runs locally and makes direct API calls on your behalf. Works with any MCP-compatible client.

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

A browser opens. Log in to HomeExchange, then press **Ctrl+C**. Your session is saved locally to `session.json` (git-ignored).

> Tokens expire after a few days. Re-run `npm run login` when tools start returning 401s.

### 3. Start the MCP server

```bash
npm run mcp
```

---

## Client setup

Works with any MCP client that supports stdio transport.

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
      "command": { "path": "npx", "args": ["ts-node", "src/mcp.ts"] }
    }
  }
}
```

---

## Tool reference

### 🔍 Search & discovery

#### `search_homes`
Search listings by location, dates, guests, and exchange type.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `location` | string | No | — | City, region, or country |
| `checkin` | string | No | — | `YYYY-MM-DD` |
| `checkout` | string | No | — | `YYYY-MM-DD` |
| `guests` | number | No | — | Number of guests |
| `exchange_type` | string | No | — | `GuestPoints` · `simultaneous` · `non_simultaneous` |
| `home_type` | string | No | — | `house` · `apartment` · `other` |
| `limit` | number | No | `20` | Results per page (max 36) |
| `offset` | number | No | `0` | Pagination offset |

#### `get_home`
Full details for a listing.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Numeric home ID |

#### `get_home_calendar`
Availability calendar — blocked and open dates for a home.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Numeric home ID |

#### `get_recommendations`
Personalised picks based on your profile and history.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `8` | Number of results |

#### `list_my_homes`
Your own listings. No parameters.

#### `list_favorites`
Your saved homes.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `20` | Number of results |

#### `add_favorite`
Save a home to your favourites.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Home ID |

#### `remove_favorite`
Remove a home from your favourites.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Home ID |

#### `list_saved_searches`
Your saved search filters.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `100` | Number of results |

#### `get_user_profile`
A member's public profile.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | **Yes** | Numeric user ID |

---

### 💬 Messaging

#### `list_conversations`
Your conversation inbox.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filter` | string | No | `ALL` | `ALL` · `UNANSWERED` · `ARCHIVED` |
| `limit` | number | No | `20` | Threads to return |
| `after` | string | No | — | Pagination cursor from previous response |

#### `get_conversation`
All messages in a thread.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | **Yes** | Conversation ID |

#### `send_message`
Reply in an existing conversation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | **Yes** | Conversation ID |
| `text` | string | **Yes** | Message text |

#### `start_conversation`
Open a new conversation about a home.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | The home you're enquiring about |
| `text` | string | **Yes** | Opening message |

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run login` | Capture auth session via browser ← start here |
| `npm run mcp` | Start the local MCP server |
| `npm run record` | Full network recorder with HAR capture (API exploration) |
| `npm run analyze` | Analyze a `.har` file → `api-map.json` |
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

- [ ] **Calendar integration** — query and update home availability, check open dates before messaging, surface conflicts across requests
- [ ] **Remote MCP** — hosted endpoint so you don't need the project running locally; requires proper OAuth/token-refresh (not manual capture)
- [ ] **Token expiry detection** — auto-prompt to re-run login on 401
- [ ] **Saved search alerts** — notify when new homes match your saved searches

---

## Disclaimer

This is an **unofficial, community project** with no affiliation with HomeExchange SAS.

- Uses your own HomeExchange account credentials, exactly as your browser does
- **Personal, non-commercial use only** — not for scraping, reselling, or commercial exploitation of HomeExchange data
- Subject to [HomeExchange's Terms of Service](https://www.homeexchange.com/en/page/terms)
- The HomeExchange API is private and undocumented — endpoints may change without notice

**The intent is to build a genuinely useful tool for the HomeExchange community, and ideally to partner with HomeExchange to do this officially.** If you work at HomeExchange and are interested in collaborating on a proper integration, please [open an issue](https://github.com/tn819/homeexchange-mcp/issues) or get in touch.

---

## License

[MIT](LICENSE) — personal and non-commercial use.

*HomeExchange® is a registered trademark of HomeExchange SAS. This project is independent and not endorsed by HomeExchange SAS.*
