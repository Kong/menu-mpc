/**
 * @jest-environment node
 */

import request from 'supertest';
import { ForFiveCoffeeServer } from '../server.js';

describe('HTTP Server', () => {
  let server;
  let app;

  beforeAll(() => {
    server = new ForFiveCoffeeServer();
    app = server.app;
  });

  describe('Basic Endpoints', () => {
    it('should respond to health check', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'for-five-coffee-mcp-server');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should respond to root endpoint', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'For Five Coffee MCP Server');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('mcp');
      expect(response.body).toHaveProperty('api');
      expect(response.body).toHaveProperty('health');
      expect(response.body.mcp).toHaveProperty('http');
      expect(response.body.mcp).toHaveProperty('stdio');
    });

    it('should respond to API documentation endpoint', async () => {
      const response = await request(app).get('/api');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'For Five Coffee MCP Server API');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body).toHaveProperty('examples');
    });
  });

  describe('Menu API Endpoints', () => {
    it('should get menu categories', async () => {
      const response = await request(app).get('/api/menu/categories');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('totalCategories');
      expect(Array.isArray(response.body.categories)).toBe(true);
    }, 120000);

    it('should search menu items with query parameter', async () => {
      const response = await request(app).get('/api/menu/search?q=coffee');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('query', 'coffee');
      expect(response.body).toHaveProperty('resultsFound');
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    }, 120000);

    it('should return 400 for search without query', async () => {
      const response = await request(app).get('/api/menu/search');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should get full menu', async () => {
      const response = await request(app).get('/api/menu');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('restaurant', 'For Five Coffee');
      expect(response.body).toHaveProperty('totalItems');
      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('lastUpdated');
      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(Array.isArray(response.body.items)).toBe(true);
    }, 120000);

    it('should get items by category', async () => {
      const response = await request(app).get('/api/menu/category/COFFEE');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('category', 'COFFEE');
      expect(response.body).toHaveProperty('itemCount');
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    }, 120000);
  });

  describe('CORS Support', () => {
    it('should include CORS headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});
