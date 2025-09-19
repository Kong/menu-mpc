export default {
  testEnvironment: 'node',
  transform: {},
  testTimeout: 30000,
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['server.js', '!**/node_modules/**'],
  // Additional settings for CI environments
  verbose: process.env.CI === 'true',
  forceExit: true,
  detectOpenHandles: true,
  // Ensure clean slate for each test
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
