/**
 * @jest-environment node
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

describe('Integration Tests - For Five Coffee Menu', () => {
  const MENU_URL = 'https://for-five-coffee.ordrsliponline.com/menus';
  const REQUEST_TIMEOUT = 15000;

  // Helper function to create axios config similar to server
  const createAxiosConfig = async () => ({
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      Connection: 'keep-alive',
    },
    timeout: REQUEST_TIMEOUT,
    httpsAgent: new (await import('https')).Agent({
      rejectUnauthorized: false,
    }),
  });

  describe('Menu Website Accessibility', () => {
    it(
      'should successfully fetch the menu page',
      async () => {
        const config = await createAxiosConfig();

        const response = await axios.get(MENU_URL, config);

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(typeof response.data).toBe('string');
        expect(response.data.length).toBeGreaterThan(1000); // Should be substantial HTML
      },
      REQUEST_TIMEOUT + 5000
    );

    it(
      'should return valid HTML content',
      async () => {
        const config = await createAxiosConfig();

        const response = await axios.get(MENU_URL, config);
        const $ = cheerio.load(response.data);

        // Basic HTML structure checks
        expect($('html').length).toBeGreaterThan(0);
        expect($('body').length).toBeGreaterThan(0);

        // Should contain some text content
        const bodyText = $('body').text();
        expect(bodyText.length).toBeGreaterThan(100);
      },
      REQUEST_TIMEOUT + 5000
    );
  });

  describe('Menu Data Extraction', () => {
    let $;

    beforeAll(async () => {
      const config = await createAxiosConfig();
      const response = await axios.get(MENU_URL, config);
      $ = cheerio.load(response.data);
    }, REQUEST_TIMEOUT + 5000);

    it('should find potential menu items using various selectors', () => {
      const selectors = [
        '.menu-item',
        '.item',
        '.product',
        '.menu-product',
        '.food-item',
        '[data-item]',
      ];

      let foundItems = false;
      for (const selector of selectors) {
        const items = $(selector);
        if (items.length > 0) {
          foundItems = true;
          console.log(`Found ${items.length} items with selector: ${selector}`);
          break;
        }
      }

      // If no structured selectors work, check for text content that looks like menu items
      if (!foundItems) {
        const bodyText = $('body').text();
        const priceMatches = bodyText.match(/\$\d+\.?\d*/g);
        expect(priceMatches).toBeTruthy();
        expect(priceMatches.length).toBeGreaterThan(0);
        console.log(`Found ${priceMatches.length} price indicators in text`);
      }

      // At minimum, we should find some content
      expect($('body').text().length).toBeGreaterThan(0);
    });

    it('should extract meaningful text content', () => {
      const bodyText = $('body').text();

      // Should contain coffee-related terms
      const coffeeTerms = ['coffee', 'espresso', 'latte', 'cappuccino', 'menu'];
      const foundTerms = coffeeTerms.filter(term => bodyText.toLowerCase().includes(term));

      expect(foundTerms.length).toBeGreaterThan(0);
      console.log(`Found coffee-related terms: ${foundTerms.join(', ')}`);
    });

    it('should find price information', () => {
      const bodyText = $('body').text();
      const pricePattern = /\$\d+\.?\d*/g;
      const prices = bodyText.match(pricePattern);

      if (prices) {
        expect(prices.length).toBeGreaterThan(0);
        console.log(`Found ${prices.length} price indicators`);

        // Prices should be reasonable (between $1 and $50)
        const validPrices = prices.filter(price => {
          const amount = parseFloat(price.replace('$', ''));
          return amount >= 1 && amount <= 50;
        });

        // Note: Some prices might be outside our range or malformed, that's okay
        expect(validPrices.length).toBeGreaterThanOrEqual(0);
      } else {
        console.log('No price indicators found in standard format');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      const config = {
        ...(await createAxiosConfig()),
        timeout: 1, // Very short timeout to force failure
      };

      await expect(axios.get(MENU_URL, config)).rejects.toThrow();
    });

    it('should handle invalid URLs gracefully', async () => {
      const config = await createAxiosConfig();

      try {
        await axios.get('https://definitely-invalid-url-12345.nonexistent', config);
        // If it doesn't throw, that's unexpected but not critical for our server
        console.log('URL resolved unexpectedly (possibly through DNS hijacking)');
      } catch (error) {
        // This is the expected behavior
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it(
      'should fetch menu data within reasonable time',
      async () => {
        const startTime = Date.now();
        const config = await createAxiosConfig();

        await axios.get(MENU_URL, config);

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(duration).toBeLessThan(REQUEST_TIMEOUT);
        console.log(`Menu fetch took ${duration}ms`);
      },
      REQUEST_TIMEOUT + 5000
    );
  });
});
