import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isPages = mode === 'pages'
  return {
    base: isPages ? '/LangStitch/app/' : '/',
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
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
  }
})
