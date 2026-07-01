import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/** Builds the LangTailor Electron renderer bundle. */
export default defineConfig({
  root: path.resolve(__dirname, 'langtailor/desktop'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    'import.meta.env.VITE_WEBVIEW': JSON.stringify('true'),
    'import.meta.env.VITE_APP_MODE': JSON.stringify('ide'),
    'import.meta.env.VITE_ELECTRON': JSON.stringify('true'),
  },
  build: {
    outDir: path.resolve(__dirname, 'langtailor/desktop/renderer-dist'),
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: path.resolve(__dirname, 'langtailor/desktop/index.html'),
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunk-[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
})
