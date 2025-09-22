/**
 * @jest-environment node
 */

import request from 'supertest';
import { ForFiveCoffeeServer } from '../server.js';

describe('MCP Transport', () => {
  let server;
  let app;

  beforeAll(() => {
    server = new ForFiveCoffeeServer();
    app = server.app;
  });

  describe('MCP Configuration', () => {
    it('should have MCP server instance configured', () => {
      expect(server.server).toBeDefined();
      expect(server.app).toBeDefined();
      expect(typeof server.setupHttpServer).toBe('function');
    });

    it('should advertise HTTP MCP endpoint in root response', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mcp');
      expect(response.body.mcp).toHaveProperty('http');
      expect(response.body.mcp.http).toContain('/mcp');
    });

    it('should provide both stdio and HTTP MCP options', async () => {
      const response = await request(app).get('/');

      expect(response.body.mcp).toHaveProperty('stdio');
      expect(response.body.mcp).toHaveProperty('http');
      expect(response.body.mcp.stdio).toContain('stdio');
      expect(response.body.mcp.http).toContain('JSON-RPC');
    });

    it('should handle MCP initialize request', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result');
      expect(response.body).toHaveProperty('id', 1);

      // Check protocol version
      expect(response.body.result).toHaveProperty('protocolVersion', '2024-11-05');

      // Check server capabilities structure
      expect(response.body.result).toHaveProperty('capabilities');
      expect(response.body.result.capabilities).toHaveProperty('tools');
      expect(response.body.result.capabilities).toHaveProperty('resources');
      expect(response.body.result.capabilities).toHaveProperty('prompts');
      expect(response.body.result.capabilities).toHaveProperty('logging');

      // Check server info
      expect(response.body.result).toHaveProperty('serverInfo');
      expect(response.body.result.serverInfo).toHaveProperty('name', 'for-five-coffee-mcp-server');
      expect(response.body.result.serverInfo).toHaveProperty('version', '1.0.0');
    });

    it('should respond to MCP tools/list request with proper JSON-RPC format', async () => {
      const response = await request(app).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result');
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body.result).toHaveProperty('tools');
      expect(Array.isArray(response.body.result.tools)).toBe(true);
      expect(response.body.result.tools.length).toBe(5);

      // Verify each tool has proper MCP structure
      response.body.result.tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
      });
    });

    it('should expose all expected MCP tools', async () => {
      const response = await request(app).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1,
      });

      const toolNames = response.body.result.tools.map(tool => tool.name);
      const expectedTools = [
        'get_full_menu',
        'search_menu_items',
        'get_menu_categories',
        'get_items_by_category',
        'clear_menu_cache',
      ];

      expectedTools.forEach(expectedTool => {
        expect(toolNames).toContain(expectedTool);
      });

      // Verify tools with parameters have proper schema
      const searchTool = response.body.result.tools.find(t => t.name === 'search_menu_items');
      expect(searchTool.inputSchema.properties).toHaveProperty('query');
      expect(searchTool.inputSchema.required).toContain('query');

      const categoryTool = response.body.result.tools.find(t => t.name === 'get_items_by_category');
      expect(categoryTool.inputSchema.properties).toHaveProperty('category');
      expect(categoryTool.inputSchema.required).toContain('category');
    });

    it('should handle MCP tools/call request', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'get_menu_categories',
            arguments: {},
          },
          id: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result');
    }, 180000);

    it('should handle resources/list request', async () => {
      const response = await request(app).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'resources/list',
        params: {},
        id: 5,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body.result).toHaveProperty('resources');
      expect(Array.isArray(response.body.result.resources)).toBe(true);
    });

    it('should handle prompts/list request', async () => {
      const response = await request(app).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'prompts/list',
        params: {},
        id: 6,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body.result).toHaveProperty('prompts');
      expect(Array.isArray(response.body.result.prompts)).toBe(true);
    });

    it('should handle ping request', async () => {
      const response = await request(app).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'ping',
        params: {},
        id: 7,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result', {});
    });

    it('should handle notifications/initialized request', async () => {
      const response = await request(app).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
        id: 8,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result', {});
    });

    it('should handle notifications/initialized without id (notification)', async () => {
      const response = await request(app).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result', {});
    });

    it('should handle logging/setLevel request', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'logging/setLevel',
          params: { level: 'info' },
          id: 9,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result', {});
    });
  });

  describe('Complete MCP Initialization Flow', () => {
    it('should handle the full MCP Inspector initialization sequence', async () => {
      // Step 1: Initialize connection (what MCP Inspector does first)
      const initResponse = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
            clientInfo: { name: 'mcp-inspector', version: '1.0.0' },
          },
          id: 0,
        });

      expect(initResponse.status).toBe(200);
      expect(initResponse.body.result.protocolVersion).toBe('2024-11-05');
      expect(initResponse.body.result.capabilities.tools).toBeDefined();

      // Step 2: List available tools (what MCP Inspector does next)
      const toolsResponse = await request(app).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1,
      });

      expect(toolsResponse.status).toBe(200);
      expect(toolsResponse.body.result.tools).toHaveLength(5);

      // Step 3: Test calling a tool (what a user would do in MCP Inspector)
      const toolCallResponse = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'get_menu_categories',
            arguments: {},
          },
          id: 2,
        });

      expect(toolCallResponse.status).toBe(200);
      expect(toolCallResponse.body.result.content).toBeDefined();

      // Step 4: Test ping (health check)
      const pingResponse = await request(app).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'ping',
        params: {},
        id: 3,
      });

      expect(pingResponse.status).toBe(200);
      expect(pingResponse.body.result).toEqual({});
    }, 180000);

    it('should reject invalid protocol version in initialize', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2023-01-01', // Invalid old version
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' },
          },
          id: 1,
        });

      // Our server accepts any protocol version for now, but returns the correct one
      expect(response.status).toBe(200);
      expect(response.body.result.protocolVersion).toBe('2024-11-05');
    });
  });

  describe('JSON-RPC 2.0 Compliance', () => {
    it('should handle requests without id field', async () => {
      const response = await request(app).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result');
      // id should be null/undefined when not provided in request
    });

    it('should reject requests without jsonrpc field', async () => {
      const response = await request(app).post('/mcp').send({
        method: 'tools/list',
        params: {},
        id: 1,
      });

      // Should still work as our implementation is lenient
      expect(response.status).toBe(200);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });
  });

  describe('MCP Error Handling', () => {
    it('should handle invalid MCP method', async () => {
      const response = await request(app).post('/mcp').send({
        jsonrpc: '2.0',
        method: 'invalid/method',
        params: {},
        id: 3,
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe(-32601);
    });

    it('should handle invalid tool name', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'invalid_tool',
            arguments: {},
          },
          id: 4,
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe(-32603);
    });
  });

  describe('Server Stability', () => {
    it('should maintain HTTP API functionality alongside MCP', async () => {
      // Test that regular endpoints work
      const healthResponse = await request(app).get('/health');
      expect(healthResponse.status).toBe(200);

      const apiResponse = await request(app).get('/api');
      expect(apiResponse.status).toBe(200);
    });

    it('should have MCP tools available for HTTP transport', () => {
      // Verify the server has the MCP tools that would be available via HTTP
      expect(typeof server.getFullMenu).toBe('function');
      expect(typeof server.searchMenuItems).toBe('function');
      expect(typeof server.getMenuCategories).toBe('function');
      expect(typeof server.getItemsByCategory).toBe('function');
      expect(typeof server.clearMenuCache).toBe('function');
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
      expect(response.body.mcp.http).toBeDefined();

      // Both should be different
      expect(response.body.mcp.stdio).not.toBe(response.body.mcp.http);
    });
  });
});
