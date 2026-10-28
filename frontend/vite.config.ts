import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A API fica sob /api no mesmo domínio (o backend serve o build em produção).
// Em dev, o proxy abaixo repassa /api para o backend local sem o prefixo.
process.env.VITE_API_URL ??= '/api';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
