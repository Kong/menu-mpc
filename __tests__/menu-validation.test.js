/**
 * @jest-environment node
 */

import { ForFiveCoffeeServer } from '../server.js';

describe('Menu Data Validation', () => {
  let server;

  beforeAll(() => {
    server = new ForFiveCoffeeServer();
  });

  describe('Full Menu Quality', () => {
    it('should return actual menu items, not JavaScript code', async () => {
      const result = await server.getFullMenu();
      const menuData = JSON.parse(result.content[0].text);

      expect(menuData).toHaveProperty('items');
      expect(Array.isArray(menuData.items)).toBe(true);

      if (menuData.items.length > 0) {
        const firstItem = menuData.items[0];

        // Menu items should not contain JavaScript code
        expect(firstItem.name).not.toMatch(/window\.|function|var |let |const /);
        expect(firstItem.name).not.toMatch(/\{|\}|;|\[|\]/);
        expect(firstItem.description).not.toMatch(/window\.|function|var |let |const /);

        // Menu items should have reasonable names (not code)
        expect(firstItem.name.length).toBeLessThan(200); // Reasonable name length
        expect(firstItem.name).not.toContain('LOCATIONS');
        expect(firstItem.name).not.toContain('tenant');
        expect(firstItem.name).not.toContain('coordinates');
      }
    }, 180000);

    it('should return menu items with valid structure', async () => {
      const result = await server.getFullMenu();
      const menuData = JSON.parse(result.content[0].text);

      expect(menuData).toHaveProperty('restaurant', 'For Five Coffee');
      expect(menuData).toHaveProperty('totalItems');
      expect(menuData).toHaveProperty('categories');
      expect(menuData).toHaveProperty('items');
      expect(menuData).toHaveProperty('lastUpdated');

      // Should have some menu items
      expect(menuData.totalItems).toBeGreaterThan(0);

      if (menuData.items.length > 0) {
        const firstItem = menuData.items[0];

        // Each item should have required fields
        expect(firstItem).toHaveProperty('name');
        expect(firstItem).toHaveProperty('price');
        expect(firstItem).toHaveProperty('category');

        // Name should be a reasonable menu item name
        expect(typeof firstItem.name).toBe('string');
        expect(firstItem.name.length).toBeGreaterThan(0);
        expect(firstItem.name.length).toBeLessThan(100);

        // Price should look like a price
        if (firstItem.price !== 'Price not available') {
          expect(firstItem.price).toMatch(/\$\d+\.?\d*/);
        }

        // Category should be reasonable
        expect(typeof firstItem.category).toBe('string');
        expect(firstItem.category.length).toBeGreaterThan(0);

        // Test ALL items have required fields
        menuData.items.forEach((item, index) => {
          expect(item).toHaveProperty('name', expect.any(String));
          expect(item).toHaveProperty('price', expect.any(String));
          expect(item).toHaveProperty('category', expect.any(String));

          expect(item.name.length).toBeGreaterThan(0);
          expect(item.category.length).toBeGreaterThan(0);

          // Each item should have a valid price or "Price not available"
          if (item.price !== 'Price not available') {
            expect(item.price).toMatch(/\$\d+\.?\d*/);
          }

          console.log(`Item ${index + 1}: ${item.name} - ${item.price} (${item.category})`);
        });
      }
    }, 180000);

    it('should find coffee-related items', async () => {
      const result = await server.getFullMenu();
      const menuData = JSON.parse(result.content[0].text);

      if (menuData.items.length > 0) {
        // For a coffee shop, we expect to find coffee-related items
        const coffeeItems = menuData.items.filter(
          item =>
            item.name.toLowerCase().includes('coffee') ||
            item.name.toLowerCase().includes('espresso') ||
            item.name.toLowerCase().includes('latte') ||
            item.name.toLowerCase().includes('cappuccino') ||
            item.name.toLowerCase().includes('americano') ||
            item.category.toLowerCase().includes('coffee') ||
            item.category.toLowerCase().includes('drink') ||
            item.category.toLowerCase().includes('beverage')
        );

        // Should find at least some coffee-related items
        expect(coffeeItems.length).toBeGreaterThan(0);
      } else {
        // If no items found, this test should fail to alert us
        throw new Error('No menu items found - menu scraping may be broken');
      }
    }, 180000);
  });

  describe('Menu Categories Quality', () => {
    it('should return all expected categories from website', async () => {
      const result = await server.getMenuCategories();
      const categoriesData = JSON.parse(result.content[0].text);

      expect(categoriesData).toHaveProperty('categories');
      expect(Array.isArray(categoriesData.categories)).toBe(true);
      expect(categoriesData.categories.length).toBeGreaterThan(3);

      // Should find the specific categories we know exist on the website
      const expectedCategories = [
        'BEVERAGES',
        'COFFEE',
        'PASTRIES',
        'FOR FIVE COOKIES',
        'GRAB N GO',
      ];
      const foundExpectedCategories = expectedCategories.filter(expected =>
        categoriesData.categories.some(
          actual =>
            actual.toUpperCase().includes(expected) || expected.includes(actual.toUpperCase())
        )
      );

      console.log('Expected categories found:', foundExpectedCategories);
      console.log('All categories:', categoriesData.categories);

      // Should find at least some of the expected categories
      expect(foundExpectedCategories.length).toBeGreaterThan(2);

      // Should include food categories (not just beverages)
      const hasFoodCategories = categoriesData.categories.some(
        category =>
          category.toUpperCase().includes('COOKIES') ||
          category.toUpperCase().includes('PASTRIES') ||
          category.toUpperCase().includes('GRAB') ||
          category.toUpperCase().includes('FOOD')
      );

      expect(hasFoodCategories).toBe(true);
    }, 180000);
  });

  describe('Search Functionality', () => {
    it('should find items when searching for coffee', async () => {
      const result = await server.searchMenuItems('coffee');
      const searchData = JSON.parse(result.content[0].text);

      expect(searchData).toHaveProperty('query', 'coffee');
      expect(searchData).toHaveProperty('resultsFound');
      expect(searchData).toHaveProperty('items');

      // For a coffee shop, searching "coffee" should return results
      if (searchData.resultsFound === 0) {
        // Get full menu to check if there are any items at all
        const fullMenuResult = await server.getFullMenu();
        const fullMenuData = JSON.parse(fullMenuResult.content[0].text);

        if (fullMenuData.totalItems > 0) {
          console.warn(
            'Menu has items but coffee search returned no results - search may need improvement'
          );
        } else {
          throw new Error('No menu items found at all - menu scraping is broken');
        }
      } else {
        expect(searchData.resultsFound).toBeGreaterThan(0);
        expect(searchData.items.length).toBeGreaterThan(0);

        // Results should be relevant to coffee
        const relevantResults = searchData.items.filter(
          item =>
            item.name.toLowerCase().includes('coffee') ||
            item.description.toLowerCase().includes('coffee') ||
            item.category.toLowerCase().includes('coffee')
        );

        expect(relevantResults.length).toBeGreaterThan(0);
      }
    }, 180000);

    it('should handle searches for common coffee shop items', async () => {
      const searchTerms = ['latte', 'espresso', 'cappuccino', 'tea'];

      for (const term of searchTerms) {
        const result = await server.searchMenuItems(term);
        const searchData = JSON.parse(result.content[0].text);

        expect(searchData).toHaveProperty('query', term);
        expect(searchData).toHaveProperty('resultsFound');
        expect(searchData).toHaveProperty('items');
        expect(Array.isArray(searchData.items)).toBe(true);

        // If results found, they should be valid menu items
        if (searchData.resultsFound > 0) {
          searchData.items.forEach(item => {
            expect(item).toHaveProperty('name');
            expect(item).toHaveProperty('price');
            expect(item).toHaveProperty('category');
            expect(typeof item.name).toBe('string');
            expect(item.name.length).toBeGreaterThan(0);
          });
        }
      }
    }, 180000);
  });

  describe('Data Consistency', () => {
    it('should have consistent data between full menu and category filtering', async () => {
      const fullMenuResult = await server.getFullMenu();
      const fullMenuData = JSON.parse(fullMenuResult.content[0].text);

      if (fullMenuData.totalItems > 0 && fullMenuData.categories.length > 0) {
        // Test each category
        for (const category of fullMenuData.categories) {
          const categoryResult = await server.getItemsByCategory(category);
          const categoryData = JSON.parse(categoryResult.content[0].text);

          expect(categoryData).toHaveProperty('category', category);
          expect(categoryData).toHaveProperty('items');
          expect(Array.isArray(categoryData.items)).toBe(true);

          // All items in category should have the correct category
          categoryData.items.forEach(item => {
            expect(item.category).toBe(category);
          });
        }
      }
    }, 180000);

    it('should have reasonable menu size for a coffee shop', async () => {
      const result = await server.getFullMenu();
      const menuData = JSON.parse(result.content[0].text);

      // A coffee shop should have multiple items
      expect(menuData.totalItems).toBeGreaterThan(1);

      // But not an unreasonable number (likely indicates parsing error)
      expect(menuData.totalItems).toBeLessThan(500);

      // Should have multiple categories for a typical coffee shop
      if (menuData.totalItems > 5) {
        expect(menuData.categories.length).toBeGreaterThan(1);
      }
    }, 180000);
  });
});
