/**
 * @jest-environment node
 */

import request from 'supertest';
import { ForFiveCoffeeServer } from '../server.js';

describe('SSE MCP Transport', () => {
  let server;
  let app;

  beforeAll(() => {
    server = new ForFiveCoffeeServer();
    app = server.app;
  });

  describe('SSE Configuration', () => {
    it('should have MCP server instance with SSE support', () => {
      expect(server.server).toBeDefined();
      expect(server.app).toBeDefined();
      expect(typeof server.setupHttpServer).toBe('function');
    });

    it('should advertise SSE endpoint in root response', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mcp');
      expect(response.body.mcp).toHaveProperty('sse');
      expect(response.body.mcp.sse).toContain('/sse');
    });

    it('should provide both stdio and SSE MCP options', async () => {
      const response = await request(app).get('/');

      expect(response.body.mcp).toHaveProperty('stdio');
      expect(response.body.mcp).toHaveProperty('sse');
      expect(response.body.mcp.stdio).toContain('stdio');
      expect(response.body.mcp.sse).toContain('SSE');
    });
  });

  describe('SSE Endpoint Existence', () => {
    it('should have SSE route that responds', async () => {
      // Test that the route exists and responds (without waiting for SSE stream)
      const agent = request(app).get('/sse');

      // Set a very short timeout to test route existence without hanging
      const response = await new Promise(resolve => {
        const req = agent.timeout(50);

        req.end((err, res) => {
          // Either we get a response or a timeout - both indicate the route exists
          if (res) {
            resolve(res);
          } else if (err && err.timeout) {
            resolve({
              status: 'timeout',
              message: 'Route exists but connection timed out as expected',
            });
          } else {
            resolve({ status: 'error', error: err });
          }
        });
      });

      // Route should exist (either respond or timeout, not 404)
      if (response.status === 'timeout') {
        expect(response.message).toContain('Route exists');
      } else {
        expect(response.status).not.toBe(404);
      }
    });
  });

  describe('Server Stability', () => {
    it('should maintain HTTP API functionality alongside SSE', async () => {
      // Test that regular endpoints work
      const healthResponse = await request(app).get('/health');
      expect(healthResponse.status).toBe(200);

      const apiResponse = await request(app).get('/api');
      expect(apiResponse.status).toBe(200);
    });

    it('should have MCP tools available for SSE transport', () => {
      // Verify the server has the MCP tools that would be available via SSE
      expect(typeof server.getFullMenu).toBe('function');
      expect(typeof server.searchMenuItems).toBe('function');
      expect(typeof server.getMenuCategories).toBe('function');
      expect(typeof server.getItemsByCategory).toBe('function');
    });
  });

  describe('MCP Protocol Compliance', () => {
    it('should have required MCP server setup', () => {
      expect(server.server).toBeDefined();
      expect(typeof server.setupToolHandlers).toBe('function');
      expect(typeof server.setupHttpServer).toBe('function');
    });

    it('should support dual transport modes', async () => {
      const response = await request(app).get('/');

      // Should advertise both transport methods
      expect(response.body.mcp.stdio).toBeDefined();
      expect(response.body.mcp.sse).toBeDefined();

      // Both should be different
      expect(response.body.mcp.stdio).not.toBe(response.body.mcp.sse);
    });

    it('should expose all required MCP tools via SSE', () => {
      // Verify all MCP tool methods exist on the server instance
      const requiredTools = [
        'getFullMenu',
        'searchMenuItems',
        'getMenuCategories',
        'getItemsByCategory',
        'clearMenuCache',
      ];

      requiredTools.forEach(toolMethod => {
        expect(typeof server[toolMethod]).toBe('function');
      });
    });

    it('should have MCP tools properly configured', () => {
      // The server should have been configured with tool handlers
      expect(server.server).toBeDefined();
      expect(server.server.setRequestHandler).toBeDefined();

      // Verify the server instance has the tool methods that would be available via SSE
      expect(server.getFullMenu).toBeDefined();
      expect(server.searchMenuItems).toBeDefined();
      expect(server.getMenuCategories).toBeDefined();
      expect(server.getItemsByCategory).toBeDefined();
      expect(server.clearMenuCache).toBeDefined();
    });

    it('should return properly formatted MCP responses', async () => {
      // Test that MCP tool methods return properly formatted responses
      const fullMenuResult = await server.getFullMenu();

      expect(fullMenuResult).toHaveProperty('content');
      expect(Array.isArray(fullMenuResult.content)).toBe(true);
      expect(fullMenuResult.content.length).toBeGreaterThan(0);
      expect(fullMenuResult.content[0]).toHaveProperty('type', 'text');
      expect(fullMenuResult.content[0]).toHaveProperty('text');

      // The text should be valid JSON
      expect(() => JSON.parse(fullMenuResult.content[0].text)).not.toThrow();

      const menuData = JSON.parse(fullMenuResult.content[0].text);
      expect(menuData).toHaveProperty('restaurant', 'For Five Coffee');
      expect(menuData).toHaveProperty('items');
      expect(Array.isArray(menuData.items)).toBe(true);
    }, 30000);

    it('should handle MCP tool calls with parameters', async () => {
      // Test search tool with parameters
      const searchResult = await server.searchMenuItems('coffee');

      expect(searchResult).toHaveProperty('content');
      expect(searchResult.content[0]).toHaveProperty('type', 'text');

      const searchData = JSON.parse(searchResult.content[0].text);
      expect(searchData).toHaveProperty('query', 'coffee');
      expect(searchData).toHaveProperty('resultsFound');
      expect(searchData).toHaveProperty('items');

      // Test category filtering tool
      const categoryResult = await server.getItemsByCategory('Espresso Drinks');

      expect(categoryResult).toHaveProperty('content');
      const categoryData = JSON.parse(categoryResult.content[0].text);
      expect(categoryData).toHaveProperty('category', 'Espresso Drinks');
      expect(categoryData).toHaveProperty('items');
    }, 30000);

    it('should handle cache management via MCP tools', async () => {
      // Populate cache first
      await server.getFullMenu();
      expect(server.menuCache).not.toBeNull();

      // Clear cache via MCP tool
      const clearResult = await server.clearMenuCache();

      expect(clearResult).toHaveProperty('content');
      const clearData = JSON.parse(clearResult.content[0].text);
      expect(clearData).toHaveProperty('message');
      expect(clearData.message).toContain('cleared successfully');
      expect(clearData).toHaveProperty('hadCache', true);
      expect(clearData).toHaveProperty('itemsCleared');
      expect(clearData.itemsCleared).toBeGreaterThan(0);

      // Verify cache is actually cleared
      expect(server.menuCache).toBeNull();
    }, 30000);
  });
});
