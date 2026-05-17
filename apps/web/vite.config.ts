import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    // 'hidden' generates .map files for DevTools but omits the //# sourceMappingURL
    // comment from JS, so prod bundles stay slim and original sources aren't auto-fetched.
    sourcemap: 'hidden',
  },
});
