import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : '/';

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
});
