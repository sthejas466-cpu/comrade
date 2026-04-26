import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    server: {
      port: 5173,
      // In dev, proxy /api calls to the backend so CORS is never an issue
      proxy: {
        '/api': {
          target: env.VITE_API_BASE || 'http://localhost:3001',
          changeOrigin: true,
        },
        '/socket.io': {
          target: env.VITE_API_BASE || 'http://localhost:3001',
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      // Split vendor chunks for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            'socket-io': ['socket.io-client'],
          },
        },
      },
    },
  };
});
