import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    reporters: 'default',
    environment: 'node',
  },
  // Two projects for clarity; run with `vitest run -p unit` or `-p integration`
  projects: [
    {
      test: {
        name: 'unit',
        include: ['**/*.test.ts'],
        exclude: ['**/integration/**', '**/.data/**'],
      },
    },
    {
      test: {
        name: 'integration',
        include: ['**/integration/**/*.test.ts'],
        poolOptions: {
          threads: { singleThread: true }, // easier for servers/ports
        },
        hookTimeout: 30000,
        testTimeout: 30000,
      },
    },
  ],
});

