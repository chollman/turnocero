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
      // Thresholds tomados ~5-6% por debajo del baseline real
      // (2026-05-22: stmts 61, branches 52, fns 61, lines 61). El
      // server tiene routers grandes (bgg, torneos, eventos) que
      // arrastran números abajo — la meta es atajar regresiones, no
      // forzar tests adicionales. Subir a medida que se extraigan
      // services y se cubran más handlers.
      thresholds: {
        statements: 55,
        branches: 47,
        functions: 55,
        lines: 55,
      },
    },
    pool: 'forks',
    forks: {
      singleFork: true,
    },
  },
});
