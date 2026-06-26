import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isPages = mode === 'pages'
  return {
    // Served from the apex domain langstitch.com → the IDE lives at /app/.
    base: isPages ? '/app/' : '/',
    build: isPages
      ? {
          outDir: 'dist/app',
          emptyOutDir: true,
        }
      : undefined,
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
  }
})
