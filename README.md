# For Five Coffee MCP Server

[![CI](https://github.com/user/menu-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/user/menu-mcp/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

A Model Context Protocol (MCP) server that provides access to [For Five Coffee](https://for-five-coffee.ordrsliponline.com/menus) menu data. Works with Claude Desktop, Cursor, and other MCP clients, plus provides a REST API.

## Quick Start

```bash
git clone <this-repo>
cd menu-mcp
npm install
npm start
```

This starts both:
- **MCP Server** (stdio) - for AI assistants
- **HTTP API** (port 3000) - for web apps

## MCP Client Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "for-five-coffee": {
      "command": "node",
      "args": ["/path/to/menu-mcp/server.js"]
    }
  }
}
```

### Cursor

**Option 1: Let Cursor start the server**
Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "for-five-coffee": {
      "command": "node",
      "args": ["/Users/marco/git/menu-mcp/server.js"],
      "env": {
        "PORT": "3000"
      }
    }
  }
}
```

**Option 2: Connect to already running server**
If you're running `npm start` separately, add this to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "for-five-coffee": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

This connects Cursor to the running MCP server via Server-Sent Events (SSE).

## Usage Examples

### Ask Your AI Assistant

- "What coffee drinks does For Five Coffee have?"
- "Search for pastries on the menu"
- "What's the cheapest coffee option?"
- "Show me all tea varieties"

### Use the HTTP API

```bash
# Get full menu
curl http://localhost:3000/api/menu

# Search for items
curl "http://localhost:3000/api/menu/search?q=latte"

# Get categories
curl http://localhost:3000/api/menu/categories
```

### In Your Code

```javascript
// Fetch menu data
const response = await fetch('http://localhost:3000/api/menu');
const menu = await response.json();

// Search items
const search = await fetch('http://localhost:3000/api/menu/search?q=coffee');
const results = await search.json();
```

```python
import requests

# Get menu
menu = requests.get('http://localhost:3000/api/menu').json()

# Search
results = requests.get('http://localhost:3000/api/menu/search', 
                      params={'q': 'latte'}).json()
```

## Available Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Server info |
| `GET /health` | Health check |
| `GET /api/menu` | Full menu |
| `GET /api/menu/search?q={query}` | Search items |
| `GET /api/menu/categories` | All categories |
| `GET /api/menu/category/{name}` | Items by category |

## MCP Tools

- `get_full_menu` - Get complete menu
- `search_menu_items` - Search by query
- `get_menu_categories` - List categories
- `get_items_by_category` - Filter by category

## Development

```bash
npm run dev          # Start with auto-restart
npm test             # Run all tests
npm run test:unit    # Unit tests only
npm run test:http    # HTTP API tests only  
npm run test:sse     # SSE MCP transport tests only
npm run test:integration # Integration tests only
npm run lint         # Check code style
```

## Troubleshooting

**MCP not working?**
- Check the absolute path to `server.js` in your config
- Restart your MCP client after config changes
- Run `npm start` manually to test

**HTTP API not responding?**
- Make sure server is running: `npm start`
- Check port 3000 isn't in use: `lsof -i :3000`
- Test: `curl http://localhost:3000/health`

**No menu data?**
- Check internet connection
- The server handles SSL issues automatically
- Website structure may have changed (fallbacks included)

## License

Apache 2.0