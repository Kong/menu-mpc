/**
 * @jest-environment node
 */

import { ForFiveCoffeeServer } from '../server.js';
import request from 'supertest';

describe('Menu Caching', () => {
  let server;
  let app;

  beforeEach(() => {
    server = new ForFiveCoffeeServer();
    app = server.app;
  });

  describe('Cache Functionality', () => {
    it('should start with empty cache', () => {
      expect(server.menuCache).toBeNull();
      expect(server.cacheTimestamp).toBeNull();
      expect(server.isCacheValid()).toBe(false);
    });

    it('should cache menu data after first fetch', async () => {
      // First call should fetch and cache
      await server.getFullMenu();

      expect(server.menuCache).not.toBeNull();
      expect(server.cacheTimestamp).not.toBeNull();
      expect(server.isCacheValid()).toBe(true);
      expect(server.menuCache.cached).toBe(true);
      expect(server.menuCache.items.length).toBeGreaterThan(0);
    }, 30000);

    it('should use cached data for subsequent requests', async () => {
      // First call to populate cache
      await server.getFullMenu();

      const cacheTimestamp = server.cacheTimestamp;

      // Wait a small amount and make another call
      await new Promise(resolve => setTimeout(resolve, 100));

      const result2 = await server.getFullMenu();
      const menuData2 = JSON.parse(result2.content[0].text);

      // Cache timestamp should be the same (no new fetch)
      expect(server.cacheTimestamp).toBe(cacheTimestamp);
      expect(menuData2.cached).toBe(true);
    }, 30000);

    it('should clear cache when requested', async () => {
      // Populate cache
      await server.getFullMenu();
      expect(server.menuCache).not.toBeNull();

      // Clear cache
      const clearResult = await server.clearMenuCache();
      const clearData = JSON.parse(clearResult.content[0].text);

      expect(clearData.message).toContain('cleared successfully');
      expect(clearData.hadCache).toBe(true);
      expect(clearData.itemsCleared).toBeGreaterThan(0);
      expect(server.menuCache).toBeNull();
      expect(server.cacheTimestamp).toBeNull();
    }, 30000);

    it('should have configurable cache expiry', () => {
      expect(server.cacheExpiryMinutes).toBe(30); // Default 30 minutes

      // Should be able to change expiry
      server.cacheExpiryMinutes = 60;
      expect(server.cacheExpiryMinutes).toBe(60);
    });
  });

  describe('Cache HTTP Endpoints', () => {
    it('should provide cache status endpoint', async () => {
      const response = await request(app).get('/api/cache/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cached');
      expect(response.body).toHaveProperty('cacheTimestamp');
      expect(response.body).toHaveProperty('cacheAgeMinutes');
      expect(response.body).toHaveProperty('expiryMinutes');
      expect(response.body).toHaveProperty('valid');
      expect(response.body).toHaveProperty('itemCount');
    });

    it('should provide cache clear endpoint', async () => {
      const response = await request(app).post('/api/cache/clear');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('cleared successfully');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should show cache status after menu fetch', async () => {
      // Fetch menu to populate cache
      await request(app).get('/api/menu');

      // Check cache status
      const response = await request(app).get('/api/cache/status');

      expect(response.body.cached).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.itemCount).toBeGreaterThan(0);
      expect(response.body.cacheAgeMinutes).toBeGreaterThanOrEqual(0);
    }, 30000);

    it('should update API documentation with cache endpoints', async () => {
      const response = await request(app).get('/api');

      expect(response.body.endpoints).toHaveProperty('GET /api/cache/status');
      expect(response.body.endpoints).toHaveProperty('POST /api/cache/clear');
      expect(response.body.examples).toHaveProperty('cacheStatus');
    });
  });

  describe('Cache Performance', () => {
    it('should be faster on cached requests', async () => {
      // First request (uncached)
      const start1 = Date.now();
      await server.getFullMenu();
      const time1 = Date.now() - start1;

      // Second request (cached)
      const start2 = Date.now();
      await server.getFullMenu();
      const time2 = Date.now() - start2;

      // Cached request should be significantly faster
      expect(time2).toBeLessThan(time1 / 2);
      console.log(`Uncached: ${time1}ms, Cached: ${time2}ms`);
    }, 30000);

    it('should maintain cache across different tool calls', async () => {
      // First call to populate cache
      await server.getFullMenu();
      const cacheTimestamp = server.cacheTimestamp;

      // Different tool calls should use same cache
      await server.searchMenuItems('coffee');
      await server.getMenuCategories();
      await server.getItemsByCategory('Espresso Drinks');

      // Cache should not have been refreshed
      expect(server.cacheTimestamp).toBe(cacheTimestamp);
    }, 30000);
  });

  describe('Cache Expiry', () => {
    it('should expire cache after configured time', () => {
      // Set very short expiry for testing
      server.cacheExpiryMinutes = 0.01; // 0.6 seconds

      // Manually set cache
      server.menuCache = { items: [], categories: [] };
      server.cacheTimestamp = new Date(Date.now() - 70000); // 70 seconds ago

      expect(server.isCacheValid()).toBe(false);
    });

    it('should use expired cache as fallback on fetch error', async () => {
      // Set expired cache
      server.menuCache = {
        items: [{ name: 'Test Item', price: '$1.00', category: 'Test' }],
        categories: ['Test'],
      };
      server.cacheTimestamp = new Date(Date.now() - 3600000); // 1 hour ago

      // Mock fetch to fail
      const originalFetch = server.fetchFromAPI;
      server.fetchFromAPI = async () => {
        throw new Error('Network error');
      };

      try {
        const result = await server.getFullMenu();
        const data = JSON.parse(result.content[0].text);

        // Should use expired cache
        expect(data.items.length).toBeGreaterThan(0);
      } finally {
        // Restore original method
        server.fetchFromAPI = originalFetch;
      }
    }, 30000);
  });
});
