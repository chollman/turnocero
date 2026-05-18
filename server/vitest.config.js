import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: [
        'app.js',
        'middleware/**/*.js',
        'models/**/*.js',
        'routes/**/*.js',
        'utils/**/*.js',
        'config/**/*.js',
      ],
      exclude: [
        'server.js',
        'scripts/**',
        'tests/**',
        'node_modules/**',
      ],
    },
    pool: 'forks',
    forks: {
      singleFork: true,
    },
  },
});
