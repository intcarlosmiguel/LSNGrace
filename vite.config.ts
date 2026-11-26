import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { gracePlugin } from './server/plugin';
export default defineConfig({
  plugins: [react(), tailwindcss(), gracePlugin()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { usePolling: true, interval: 300 } },
});
