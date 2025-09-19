#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
        },
        examples: {
          fullMenu: `${req.protocol}://${req.get('host')}/api/menu`,
          search: `${req.protocol}://${req.get('host')}/api/menu/search?q=latte`,
          categories: `${req.protocol}://${req.get('host')}/api/menu/categories`,
          category: `${req.protocol}://${req.get('host')}/api/menu/category/Coffee`,
        },
      });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'For Five Coffee MCP Server',
        version: '1.0.0',
        mcp: 'Model Context Protocol server running on stdio',
        http: `HTTP API available at ${req.protocol}://${req.get('host')}/api`,
        health: `${req.protocol}://${req.get('host')}/health`,
      });
    });
  }

  setupErrorHandling() {
    this.server.onerror = error => console.error('[MCP Error]', error);
  }

  async fetchMenuData() {
    try {
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

      return {
        items: menuItems,
        categories: Array.from(categories),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching menu data:', error.message);
      throw new Error(`Failed to fetch menu data: ${error.message}`);
    }
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
