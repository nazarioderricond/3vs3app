import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api/supabase': {
        target: 'https://etbpjlpbzvqcpphsywgu.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/supabase/, ''),
        secure: true,
        ws: true,
      }
    }
  },
  build: {
    outDir: 'dist',
  },
});
