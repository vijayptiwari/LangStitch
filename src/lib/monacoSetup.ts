import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

// By default @monaco-editor/react fetches the editor from a CDN, which never
// resolves in the offline / file:// desktop build (perpetual "Loading…").
// Bundle Monaco locally and provide the web worker so it loads instantly.
declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment
  }
}

if (typeof window !== 'undefined') {
  window.MonacoEnvironment = {
    getWorker() {
      return new editorWorker()
    },
  }
  loader.config({ monaco })
}

export {}
