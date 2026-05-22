import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/main.jsx',
        'src/**/*.test.{js,jsx}',
        'src/test/**',
        'src/**/*.module.css',
      ],
      // Thresholds tomados ~3-7% por debajo del baseline real
      // (2026-05-22: stmts 82, branches 74, fns 75, lines 85). La idea
      // no es ser estricto — es atajar regresiones grandes en `npm run
      // test:coverage` antes de que entren a master. Subir gradualmente
      // a medida que sube el baseline.
      thresholds: {
        statements: 75,
        branches: 68,
        functions: 70,
        lines: 80,
      },
    },
  },
});
