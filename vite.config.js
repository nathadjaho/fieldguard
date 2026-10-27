import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs in server/dev.js on port 8787 (the same handlers
// Vercel serves from api/ in production), so the browser never sees the key.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
  test: { environment: 'node' }
});
