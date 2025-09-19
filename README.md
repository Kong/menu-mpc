# For Five Coffee MCP Server

[![CI](https://github.com/user/menu-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/user/menu-mcp/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

A Model Context Protocol (MCP) server that exposes menu items from [For Five Coffee](https://for-five-coffee.ordrsliponline.com/menus). This server allows AI assistants to fetch, search, and organize menu information from the café.

## Features

- **Full Menu Access**: Retrieve the complete menu with all categories and items
- **Smart Search**: Search for menu items by name, description, or category
- **Category Filtering**: Get items from specific menu categories
- **Category Listing**: View all available menu categories
- **Robust Scraping**: Multiple fallback methods to extract menu data from the website
- **Production Ready**: Comprehensive testing, linting, and CI/CD pipeline

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Running the Server

```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

### Integration with MCP Clients

#### Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "for-five-coffee": {
      "command": "node",
      "args": ["/path/to/your/menu-mcp/server.js"]
    }
  }
}
```

#### Cursor

Add to your Cursor MCP configuration:

```json
{
  "mcpServers": {
    "for-five-coffee": {
      "command": "node",
      "args": ["/path/to/your/menu-mcp/server.js"]
    }
  }
}
```

## Available Tools

### 1. `get_full_menu`
Fetches the complete menu from For Five Coffee including all categories and items.

**Parameters**: None

**Example Response**:
```json
{
  "restaurant": "For Five Coffee",
  "totalItems": 25,
  "categories": ["Coffee", "Tea", "Pastries", "Sandwiches"],
  "items": [
    {
      "name": "Espresso",
      "description": "Rich and bold espresso shot",
      "price": "$3.50",
      "category": "Coffee"
    }
  ],
  "lastUpdated": "2025-09-19T10:30:00.000Z"
}
```

### 2. `search_menu_items`
Search for specific menu items by name, description, or category.

**Parameters**:
- `query` (string, required): Search term to find in menu items

**Example Usage**:
```json
{
  "name": "search_menu_items",
  "arguments": {
    "query": "latte"
  }
}
```

### 3. `get_menu_categories`
Get all available menu categories.

**Parameters**: None

**Example Response**:
```json
{
  "categories": ["Coffee", "Tea", "Pastries", "Sandwiches"],
  "totalCategories": 4
}
```

### 4. `get_items_by_category`
Get all menu items from a specific category.

**Parameters**:
- `category` (string, required): The category name to filter by

**Example Usage**:
```json
{
  "name": "get_items_by_category",
  "arguments": {
    "category": "Coffee"
  }
}
```

## Example MCP Tool Calls

### Get Full Menu

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_full_menu",
    "arguments": {}
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{
        \"restaurant\": \"For Five Coffee\",
        \"totalItems\": 15,
        \"categories\": [\"Coffee\", \"Tea\", \"Pastries\"],
        \"items\": [
          {
            \"name\": \"Cappuccino\",
            \"description\": \"Rich espresso with steamed milk foam\",
            \"price\": \"$4.50\",
            \"category\": \"Coffee\"
          }
        ],
        \"lastUpdated\": \"2025-09-19T01:15:00.000Z\"
      }"
    }
  ]
}
```

### Search Menu Items

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "search_menu_items",
    "arguments": {
      "query": "latte"
    }
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{
        \"query\": \"latte\",
        \"resultsFound\": 3,
        \"items\": [
          {
            \"name\": \"Vanilla Latte\",
            \"description\": \"Espresso with steamed milk and vanilla syrup\",
            \"price\": \"$5.00\",
            \"category\": \"Coffee\"
          }
        ]
      }"
    }
  ]
}
```

## AI Assistant Integration Examples

### Claude Desktop

After configuring the MCP server, you can ask Claude:
- "What coffee drinks does For Five Coffee have?"
- "Search for pastries on the menu"
- "Show me all the tea options"
- "What categories are available on the menu?"

### Cursor

Similar configuration in Cursor's MCP settings allows you to:
- Get menu information while coding a food ordering app
- Reference actual menu items in documentation
- Use real menu data for testing purposes

## Tips for Usage

1. **Broad Searches**: Use general terms like "coffee", "sweet", or "hot" to find related items
2. **Category Filtering**: Get the categories first, then filter by specific ones
3. **Price Comparison**: The full menu shows all prices for easy comparison
4. **Real-time Data**: The server fetches fresh data from the website each time

## Technical Details

### Web Scraping Strategy

The server uses a robust multi-layered approach to extract menu data:

1. **Primary Selectors**: Tries common CSS selectors for menu items
2. **Fallback Parsing**: If structured data isn't found, parses plain text content
3. **Smart Extraction**: Uses multiple selector patterns to find names, descriptions, and prices
4. **Category Detection**: Attempts to identify menu categories from page structure

### Error Handling

- Network timeouts (10 second limit)
- Graceful fallbacks when menu structure changes
- Detailed error messages for debugging
- Automatic retry logic for transient failures

### Data Structure

Each menu item contains:
- `name`: The item name
- `description`: Item description (if available)
- `price`: Price information
- `category`: Menu category (detected or defaults to "General")

## Development

### Project Structure

```
menu-mcp/
├── server.js                    # Main MCP server implementation
├── package.json                 # Project dependencies and scripts
├── LICENSE                      # Apache 2.0 license
├── README.md                    # This documentation
├── eslint.config.js             # ESLint configuration
├── .prettierrc                  # Prettier configuration
├── .gitignore                   # Git ignore patterns
├── __tests__/
│   ├── server.test.js           # Unit tests
│   └── integration.test.js      # Integration tests
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI/CD
└── claude_desktop_config.example.json  # Example MCP client config
```

### Dependencies

**Production:**
- `@modelcontextprotocol/sdk`: Official MCP SDK (latest)
- `axios`: HTTP client for web requests (latest)
- `cheerio`: Server-side HTML parsing and manipulation (latest)

**Development:**
- `eslint`: Code linting
- `prettier`: Code formatting
- `jest`: Testing framework
- `supertest`: HTTP assertion library

### Scripts

```bash
npm start          # Start the MCP server
npm run dev        # Start with auto-restart
npm test           # Run all tests
npm run test:watch # Run tests in watch mode
npm run lint       # Check code style
npm run lint:fix   # Fix code style issues
npm run format     # Format code with Prettier
npm run validate   # Validate server syntax
```

### Testing

The project includes comprehensive testing:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test actual menu fetching from the website
- **CI/CD Pipeline**: Automated testing on multiple Node.js versions

Run tests:
```bash
npm test
```

Run integration tests only:
```bash
npm test -- --testPathPattern="integration.test.js"
```

### Code Quality

The project uses ESLint and Prettier for consistent code style:

```bash
npm run lint        # Check for style issues
npm run lint:fix    # Automatically fix issues
npm run format      # Format all code
```

### Extending the Server

To add new functionality:

1. Add a new tool definition in the `ListToolsRequestSchema` handler
2. Implement the tool logic in the `CallToolRequestSchema` handler
3. Add any new helper methods to the `ForFiveCoffeeServer` class
4. Write tests for the new functionality
5. Update documentation

## Troubleshooting

### Common Issues

1. **"Failed to fetch menu data"**: Check internet connection and verify the For Five Coffee website is accessible
2. **"No menu items found"**: The website structure may have changed - the scraper includes fallback methods
3. **"Tool not found"**: Ensure the MCP client is properly configured and the server is running

### Debugging

Run the server with additional logging:
```bash
DEBUG=* npm start
```

## License

MIT License - feel free to modify and distribute as needed.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.
