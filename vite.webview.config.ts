import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds the LangStitch canvas into a single bundle that the LangTailor VS Code
// extension loads inside a webview. Output goes to the extension's media/ dir.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_WEBVIEW': JSON.stringify('true'),
  },
  build: {
    outDir: 'langtailor/extension/media',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: 'src/webview/main.tsx',
      output: {
        entryFileNames: 'webview.js',
        chunkFileNames: 'webview-[name].js',
        assetFileNames: 'webview.[ext]',
      },
    },
  },
})
