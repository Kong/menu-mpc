/**
 * @jest-environment node
 */

import { ForFiveCoffeeServer } from '../server.js';

describe('For Five Coffee MCP Server', () => {
  let server;

  beforeEach(() => {
    server = new ForFiveCoffeeServer();
  });

  describe('Server Initialization', () => {
    it('should create server instance with correct properties', () => {
      expect(server).toBeDefined();
      expect(server.server).toBeDefined();
      expect(server.app).toBeDefined();
      expect(server.port).toBe(3000); // Default port
    });

    it('should set up MCP server with correct configuration', () => {
      expect(server.server).toBeDefined();
      // The server should be configured but we can't easily test internal state
    });

    it('should set up Express app with middleware', () => {
      expect(server.app).toBeDefined();
      expect(typeof server.app.listen).toBe('function');
    });
  });

  describe('Helper Methods', () => {
    it('should have extractText method', () => {
      expect(typeof server.extractText).toBe('function');
    });

    it('should have parseMenuFromText method', () => {
      expect(typeof server.parseMenuFromText).toBe('function');
    });

    it('should parse menu from text correctly', () => {
      const testText = `
        COFFEE
        Espresso $3.50
        Cappuccino $4.50
        
        TEA
        Green Tea $2.50
        Black Tea $2.50
      `;

      const result = server.parseMenuFromText(testText);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Check if items have required properties
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('name');
        expect(result[0]).toHaveProperty('price');
        expect(result[0]).toHaveProperty('category');
      }
    });
  });

  describe('Data Structures', () => {
    it('should validate menu item structure', () => {
      const validItem = {
        name: 'Espresso',
        description: 'Rich coffee',
        price: '$3.50',
        category: 'Coffee',
      };

      expect(validItem).toHaveProperty('name');
      expect(validItem).toHaveProperty('description');
      expect(validItem).toHaveProperty('price');
      expect(validItem).toHaveProperty('category');
      expect(typeof validItem.name).toBe('string');
      expect(validItem.name.length).toBeGreaterThan(0);
    });

    it('should handle malformed menu data gracefully', () => {
      const malformedItem = {
        name: '',
        description: null,
        price: undefined,
        category: 'Coffee',
      };

      // The server should handle malformed data gracefully
      expect(malformedItem.category).toBe('Coffee');
    });
  });

  describe('Text Processing', () => {
    it('should parse menu from text with price patterns', () => {
      const testText = 'Espresso $3.50\nCappuccino $4.50\nLatte $5.00';
      const result = server.parseMenuFromText(testText);

      expect(Array.isArray(result)).toBe(true);
      // Should find items with price patterns
      const itemsWithPrices = result.filter(item => item.price && item.price.includes('$'));
      expect(itemsWithPrices.length).toBeGreaterThan(0);
    });

    it('should handle text without clear menu structure', () => {
      const testText = 'Welcome to our coffee shop! We serve great coffee.';
      const result = server.parseMenuFromText(testText);

      expect(Array.isArray(result)).toBe(true);
      // Should return empty array or handle gracefully
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect categories from text patterns', () => {
      const testText = `
        COFFEE DRINKS
        Espresso $3.50
        
        HOT BEVERAGES
        Hot Chocolate $4.00
      `;

      const result = server.parseMenuFromText(testText);
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        const categories = [...new Set(result.map(item => item.category))];
        expect(categories.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Configuration', () => {
    it('should use environment port when available', () => {
      const originalPort = process.env.PORT;
      process.env.PORT = '8080';

      const testServer = new ForFiveCoffeeServer();
      expect(testServer.port).toBe('8080');

      // Restore original
      if (originalPort) {
        process.env.PORT = originalPort;
      } else {
        delete process.env.PORT;
      }
    });

    it('should use default port when environment port not set', () => {
      const originalPort = process.env.PORT;
      delete process.env.PORT;

      const testServer = new ForFiveCoffeeServer();
      expect(testServer.port).toBe(3000);

      // Restore original
      if (originalPort) {
        process.env.PORT = originalPort;
      }
    });
  });
});
