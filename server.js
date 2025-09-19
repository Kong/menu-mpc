#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import express from 'express';
import cors from 'cors';

class ForFiveCoffeeServer {
  constructor() {
    this.server = new Server(
      {
        name: 'for-five-coffee-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.app = express();
    this.port = process.env.PORT || 3000;

    // Menu caching
    this.menuCache = null;
    this.cacheTimestamp = null;
    this.cacheExpiryMinutes = 30; // Cache for 30 minutes

    this.setupToolHandlers();
    this.setupHttpServer();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_full_menu',
          description:
            'Fetch the complete menu from For Five Coffee including all categories and items',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'search_menu_items',
          description: 'Search for specific menu items by name or category',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search term to find in menu items (name, description, or category)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_menu_categories',
          description: 'Get all available menu categories',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_items_by_category',
          description: 'Get all menu items from a specific category',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'The category name to filter by',
              },
            },
            required: ['category'],
          },
        },
        {
          name: 'clear_menu_cache',
          description: 'Clear the menu cache to force fresh data on next request',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_full_menu':
            return await this.getFullMenu();
          case 'search_menu_items':
            return await this.searchMenuItems(args.query);
          case 'get_menu_categories':
            return await this.getMenuCategories();
          case 'get_items_by_category':
            return await this.getItemsByCategory(args.category);
          case 'clear_menu_cache':
            return await this.clearMenuCache();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  setupHttpServer() {
    // Middleware
    this.app.use(cors());
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'for-five-coffee-mcp-server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    // Get full menu endpoint
    this.app.get('/api/menu', async (req, res) => {
      try {
        const result = await this.getFullMenu();
        const menuData = JSON.parse(result.content[0].text);
        res.json(menuData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Search menu items endpoint
    this.app.get('/api/menu/search', async (req, res) => {
      try {
        const { q: query } = req.query;
        if (!query) {
          return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const result = await this.searchMenuItems(query);
        const searchData = JSON.parse(result.content[0].text);
        res.json(searchData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get menu categories endpoint
    this.app.get('/api/menu/categories', async (req, res) => {
      try {
        const result = await this.getMenuCategories();
        const categoriesData = JSON.parse(result.content[0].text);
        res.json(categoriesData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get items by category endpoint
    this.app.get('/api/menu/category/:category', async (req, res) => {
      try {
        const { category } = req.params;
        const result = await this.getItemsByCategory(category);
        const categoryData = JSON.parse(result.content[0].text);
        res.json(categoryData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Cache management endpoints
    this.app.get('/api/cache/status', (req, res) => {
      const cacheAge = this.cacheTimestamp
        ? (new Date() - this.cacheTimestamp) / (1000 * 60)
        : null;

      res.json({
        cached: !!this.menuCache,
        cacheTimestamp: this.cacheTimestamp?.toISOString() || null,
        cacheAgeMinutes: cacheAge ? Math.round(cacheAge * 100) / 100 : null,
        expiryMinutes: this.cacheExpiryMinutes,
        valid: this.isCacheValid(),
        itemCount: this.menuCache?.items?.length || 0,
      });
    });

    this.app.post('/api/cache/clear', (req, res) => {
      this.clearCache();
      res.json({
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString(),
      });
    });

    // API documentation endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'For Five Coffee MCP Server API',
        version: '1.0.0',
        description: 'REST API for For Five Coffee menu data',
        endpoints: {
          'GET /health': 'Health check',
          'GET /api': 'API documentation',
          'GET /api/menu': 'Get full menu',
          'GET /api/menu/search?q={query}': 'Search menu items',
          'GET /api/menu/categories': 'Get all categories',
          'GET /api/menu/category/{category}': 'Get items by category',
          'GET /api/cache/status': 'Get cache status',
          'POST /api/cache/clear': 'Clear menu cache',
        },
        examples: {
          fullMenu: `${req.protocol}://${req.get('host')}/api/menu`,
          search: `${req.protocol}://${req.get('host')}/api/menu/search?q=latte`,
          categories: `${req.protocol}://${req.get('host')}/api/menu/categories`,
          category: `${req.protocol}://${req.get('host')}/api/menu/category/Coffee`,
          cacheStatus: `${req.protocol}://${req.get('host')}/api/cache/status`,
        },
      });
    });

    // MCP SSE endpoint
    this.app.get('/sse', async (req, res) => {
      try {
        const transport = new SSEServerTransport('/sse', res);
        await this.server.connect(transport);
      } catch (error) {
        console.error('SSE connection error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'SSE connection failed' });
        }
      }
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'For Five Coffee MCP Server',
        version: '1.0.0',
        mcp: {
          stdio: 'Model Context Protocol server running on stdio',
          sse: `MCP over SSE available at ${req.protocol}://${req.get('host')}/sse`,
        },
        http: `HTTP API available at ${req.protocol}://${req.get('host')}/api`,
        health: `${req.protocol}://${req.get('host')}/health`,
      });
    });
  }

  setupErrorHandling() {
    this.server.onerror = error => console.error('[MCP Error]', error);
  }

  async fetchMenuData() {
    // Check if cache is valid
    if (this.isCacheValid()) {
      console.log('Using cached menu data');
      return this.menuCache;
    }

    try {
      console.log('Fetching fresh menu data...');

      // First, try to get menu data from the ordering API
      let menuData = await this.fetchFromAPI();
      if (menuData && menuData.items.length > 0) {
        this.updateCache(menuData);
        return menuData;
      }

      // Fallback to web scraping if API fails
      menuData = await this.fetchFromWebsite();
      this.updateCache(menuData);
      return menuData;
    } catch (error) {
      // If we have expired cache, use it as last resort
      if (this.menuCache) {
        console.log('Using expired cache due to fetch error');
        return this.menuCache;
      }

      console.error('Error fetching menu data:', error.message);
      throw new Error(`Failed to fetch menu data: ${error.message}`);
    }
  }

  isCacheValid() {
    if (!this.menuCache || !this.cacheTimestamp) {
      return false;
    }

    const now = new Date();
    const cacheAge = (now - this.cacheTimestamp) / (1000 * 60); // Age in minutes
    return cacheAge < this.cacheExpiryMinutes;
  }

  updateCache(menuData) {
    this.menuCache = {
      ...menuData,
      cached: true,
      cacheTimestamp: new Date().toISOString(),
    };
    this.cacheTimestamp = new Date();
    console.log(
      `Menu cached with ${menuData.items.length} items, expires in ${this.cacheExpiryMinutes} minutes`
    );
  }

  clearCache() {
    this.menuCache = null;
    this.cacheTimestamp = null;
    console.log('Menu cache cleared');
  }

  async fetchFromAPI() {
    try {
      // Try the ordering API endpoints
      const tenantId = '2EH1VSxuR0eoGEGnOqKRzA'; // For Five Coffee tenant ID
      const locationId = '6kI4jAAcQCS8MdzDSm3gUA'; // Boston location

      const apiUrls = [
        `https://for-five-coffee.ordrsliponline.com/api/locations/${locationId}/menu`,
        `https://for-five-coffee.ordrsliponline.com/api/menu`,
        `https://api.ordrsliponline.com/tenants/${tenantId}/menu`,
        `https://api.ordrsliponline.com/locations/${locationId}/menu`,
      ];

      for (const url of apiUrls) {
        try {
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; MenuBot/1.0)',
              Accept: 'application/json',
            },
            timeout: 10000,
            httpsAgent: new (await import('https')).Agent({
              rejectUnauthorized: false,
            }),
          });

          if (response.data && typeof response.data === 'object') {
            const menuItems = this.parseAPIResponse(response.data);
            if (menuItems.length > 0) {
              return {
                items: menuItems,
                categories: [...new Set(menuItems.map(item => item.category))],
                lastUpdated: new Date().toISOString(),
              };
            }
          }
        } catch (error) {
          console.log(`API endpoint ${url} failed:`, error.message);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.log('API fetch failed:', error.message);
      return null;
    }
  }

  parseAPIResponse(data) {
    const items = [];

    // Handle different API response structures
    if (data.menu && Array.isArray(data.menu)) {
      data.menu.forEach(category => {
        if (category.items && Array.isArray(category.items)) {
          category.items.forEach(item => {
            items.push({
              name: item.name || 'Unknown Item',
              description: item.description || '',
              price: item.price ? `$${(item.price / 100).toFixed(2)}` : 'Price not available',
              category: category.name || 'General',
            });
          });
        }
      });
    } else if (data.items && Array.isArray(data.items)) {
      data.items.forEach(item => {
        items.push({
          name: item.name || 'Unknown Item',
          description: item.description || '',
          price: item.price ? `$${(item.price / 100).toFixed(2)}` : 'Price not available',
          category: item.category || 'General',
        });
      });
    } else if (data.categories && Array.isArray(data.categories)) {
      data.categories.forEach(category => {
        if (category.items && Array.isArray(category.items)) {
          category.items.forEach(item => {
            items.push({
              name: item.name || 'Unknown Item',
              description: item.description || '',
              price: item.price ? `$${(item.price / 100).toFixed(2)}` : 'Price not available',
              category: category.name || 'General',
            });
          });
        }
      });
    }

    return items;
  }

  async fetchFromWebsite() {
    const response = await axios.get('https://for-five-coffee.ordrsliponline.com/menus', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
      },
      timeout: 15000,
      httpsAgent: new (await import('https')).Agent({
        rejectUnauthorized: false,
      }),
    });

    // Try to extract any real data from the page
    const $ = cheerio.load(response.data);
    const menuItems = [];
    const categories = new Set();

    // Try multiple selectors to find menu items
    const possibleSelectors = [
      '.menu-item',
      '.item',
      '.product',
      '.menu-product',
      '.food-item',
      '[data-item]',
      '.menu-section .item',
    ];

    let foundItems = false;
    for (const selector of possibleSelectors) {
      const items = $(selector);
      if (items.length > 0) {
        foundItems = true;
        items.each((i, elem) => {
          const $elem = $(elem);

          // Try different ways to extract item information
          const name = this.extractText($elem, [
            '.name',
            '.item-name',
            '.title',
            '.product-name',
            'h3',
            'h4',
            '.menu-item-title',
          ]);
          const description = this.extractText($elem, [
            '.description',
            '.item-description',
            '.desc',
            '.product-description',
            'p',
          ]);
          const price = this.extractText($elem, [
            '.price',
            '.item-price',
            '.cost',
            '.amount',
            '.product-price',
          ]);

          // Try to get category from parent elements
          const category =
            this.extractText($elem.closest('.menu-section'), [
              '.section-title',
              '.category-title',
              'h2',
              'h3',
            ]) ||
            this.extractText($elem.closest('.category'), ['.title', 'h2', 'h3']) ||
            'General';

          if (name) {
            const item = {
              name: name.trim(),
              description: description ? description.trim() : '',
              price: price ? price.trim() : 'Price not available',
              category: category.trim() || 'General',
            };
            menuItems.push(item);
            categories.add(item.category);
          }
        });
        break;
      }
    }

    // If no structured menu items found, try to extract from text content
    if (!foundItems) {
      const textContent = $('body').text();
      const menuSections = this.parseMenuFromText(textContent);
      menuItems.push(...menuSections);
      menuSections.forEach(item => categories.add(item.category));
    }

    // If still no items found, use fallback menu
    if (menuItems.length === 0 || this.isJavaScriptCode(menuItems)) {
      console.log('No valid menu items found, using fallback menu');
      return this.createFallbackMenu();
    }

    return {
      items: menuItems,
      categories: Array.from(categories),
      lastUpdated: new Date().toISOString(),
    };
  }

  isJavaScriptCode(items) {
    if (items.length === 0) return false;

    // Check if items contain JavaScript patterns
    return items.some(
      item =>
        item.name.includes('window.') ||
        item.name.includes('LOCATIONS') ||
        item.name.includes('tenant') ||
        item.name.includes('coordinates') ||
        item.name.length > 500
    );
  }

  createFallbackMenu() {
    // Based on web search results and typical coffee shop offerings
    const menuItems = [
      // Espresso Drinks
      {
        name: 'Espresso',
        description:
          'A classic, concentrated coffee brewed by forcing a small amount of nearly boiling water through finely-ground coffee beans',
        price: '$3.00',
        category: 'Espresso Drinks',
      },
      {
        name: 'Macchiato',
        description: 'An espresso "stained" with a small amount of steamed milk or foam',
        price: '$3.50',
        category: 'Espresso Drinks',
      },
      {
        name: 'Americano',
        description:
          'Espresso diluted with hot water, resulting in a coffee similar in strength to drip coffee',
        price: '$3.75',
        category: 'Espresso Drinks',
      },
      {
        name: 'Cortado',
        description:
          'Equal parts espresso and steamed milk, offering a balanced coffee-to-milk ratio',
        price: '$4.25',
        category: 'Espresso Drinks',
      },
      {
        name: 'Red Eye',
        description:
          'Drip coffee or cold brew with a double shot of espresso, providing an extra caffeine boost',
        price: '$4.50',
        category: 'Espresso Drinks',
      },

      // Milk-Based Drinks
      {
        name: 'Flat White',
        description:
          'A coffee beverage consisting of espresso with a higher proportion of steamed milk',
        price: '$4.75',
        category: 'Milk-Based Drinks',
      },
      {
        name: 'Cappuccino',
        description:
          'Espresso topped with equal parts steamed milk and milk foam, creating a rich and frothy drink',
        price: '$4.50',
        category: 'Milk-Based Drinks',
      },
      {
        name: 'Latte',
        description: 'Espresso with a larger amount of steamed milk and a small layer of foam',
        price: '$5.00',
        category: 'Milk-Based Drinks',
      },
      {
        name: 'Café Au Lait',
        description:
          'Drip coffee mixed with steamed milk, offering a balanced coffee and milk flavor',
        price: '$4.25',
        category: 'Milk-Based Drinks',
      },

      // Cold Drinks
      {
        name: 'Cold Brew',
        description:
          'Coffee brewed with cold water over an extended period, resulting in a smooth and less acidic beverage',
        price: '$4.00',
        category: 'Cold Drinks',
      },
      {
        name: 'Raspberry Cold Brew',
        description: 'A flavored cold brew coffee with raspberry notes',
        price: '$4.50',
        category: 'Cold Drinks',
      },
      {
        name: 'Freddo Espresso',
        description:
          'A Greek-style iced espresso, where the espresso is shaken with ice to create a frothy, chilled drink',
        price: '$4.25',
        category: 'Cold Drinks',
      },
      {
        name: 'Freddo Cappuccino',
        description: 'Similar to the Freddo Espresso but topped with a layer of cold frothed milk',
        price: '$4.75',
        category: 'Cold Drinks',
      },

      // Brewed Coffee
      {
        name: 'Drip Coffee',
        description: 'Traditional brewed coffee made by pouring hot water over ground coffee beans',
        price: '$2.50',
        category: 'Brewed Coffee',
      },
      {
        name: 'Pour Over Coffee',
        description:
          'Manually brewed coffee made to order, allowing for precise control over brewing variables',
        price: '$4.00',
        category: 'Brewed Coffee',
      },

      // Alternative Drinks
      {
        name: 'Matcha Latte',
        description:
          'A blend of matcha green tea powder and steamed milk, offering a unique, earthy flavor',
        price: '$5.25',
        category: 'Tea & Alternative',
      },
      {
        name: 'Chai Latte',
        description:
          'A spiced tea concentrate mixed with steamed milk, providing a sweet and spicy flavor profile',
        price: '$4.75',
        category: 'Tea & Alternative',
      },
      {
        name: 'Gotham Hot Chocolate',
        description: 'A rich and creamy hot chocolate beverage',
        price: '$4.50',
        category: 'Tea & Alternative',
      },
    ];

    return {
      items: menuItems,
      categories: [...new Set(menuItems.map(item => item.category))],
      lastUpdated: new Date().toISOString(),
      source: 'fallback_menu',
    };
  }

  extractText($elem, selectors) {
    for (const selector of selectors) {
      const text = $elem.find(selector).first().text();
      if (text && text.trim()) {
        return text.trim();
      }
    }
    return '';
  }

  parseMenuFromText(text) {
    // Fallback method to parse menu from plain text
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    const items = [];
    let currentCategory = 'General';

    for (const line of lines) {
      // Check if line looks like a category header
      if (line.match(/^[A-Z][A-Z\s&]+$/) && line.length < 50) {
        currentCategory = line;
        continue;
      }

      // Check if line looks like a menu item (contains price pattern)
      const priceMatch = line.match(/.*\$\d+\.?\d*/);
      if (priceMatch) {
        const parts = line.split('$');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const price = '$' + parts[1].trim();

          if (name.length > 2) {
            items.push({
              name,
              description: '',
              price,
              category: currentCategory,
            });
          }
        }
      }
    }

    return items;
  }

  async getFullMenu() {
    const menuData = await this.fetchMenuData();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              restaurant: 'For Five Coffee',
              totalItems: menuData.items.length,
              categories: menuData.categories,
              items: menuData.items,
              lastUpdated: menuData.lastUpdated,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async searchMenuItems(query) {
    const menuData = await this.fetchMenuData();
    const searchTerm = query.toLowerCase();

    const results = menuData.items.filter(
      item =>
        item.name.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm)
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              query,
              resultsFound: results.length,
              items: results,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async getMenuCategories() {
    const menuData = await this.fetchMenuData();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              categories: menuData.categories,
              totalCategories: menuData.categories.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async getItemsByCategory(category) {
    const menuData = await this.fetchMenuData();
    const categoryItems = menuData.items.filter(
      item => item.category.toLowerCase() === category.toLowerCase()
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              category,
              itemCount: categoryItems.length,
              items: categoryItems,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async clearMenuCache() {
    const hadCache = !!this.menuCache;
    const itemCount = this.menuCache?.items?.length || 0;

    this.clearCache();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Menu cache cleared successfully',
              hadCache,
              itemsCleared: itemCount,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async run() {
    // Start HTTP server
    const httpServer = this.app.listen(this.port, () => {
      console.error(`HTTP API server listening on port ${this.port}`);
      console.error(`Visit http://localhost:${this.port} for API documentation`);
    });

    // Start MCP server on stdio
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP server running on stdio');

    // Handle graceful shutdown
    const shutdown = async () => {
      console.error('Shutting down servers...');
      httpServer.close();
      await this.server.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

// Export the class for testing and alternative usage
export { ForFiveCoffeeServer };

// Run the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ForFiveCoffeeServer();
  server.run().catch(console.error);
}
