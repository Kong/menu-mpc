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
  });
});
