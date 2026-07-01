import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSettings } from './settings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let apiProcess: ChildProcess | null = null
const DEFAULT_PORT = 8787

function repoRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'platform')
  }
  return path.resolve(__dirname, '../../../../')
}

export function platformApiBase(): string {
  const port = getSettings().serverPort || DEFAULT_PORT
  return `http://127.0.0.1:${port}/api`
}

async function waitForHealth(base: string, attempts = 40): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) return true
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

/** Start the FastAPI platform API as a local sidecar (dev / desktop IDE). */
export async function startPlatformServer(): Promise<{ ok: boolean; base: string }> {
  const port = getSettings().serverPort || DEFAULT_PORT
  const base = `http://127.0.0.1:${port}/api`

  // Already running from a previous session or manual `npm run dev:api`.
  if (await waitForHealth(base, 4)) {
    return { ok: true, base }
  }

  const root = repoRoot()
  const python = getSettings().pythonPath || 'python'
  apiProcess = spawn(
    python,
    ['-m', 'uvicorn', 'server.main:app', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: root,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        LANGSTITCH_API_BASE_URL: `http://127.0.0.1:${port}`,
      },
    },
  )

  apiProcess.stderr?.on('data', (d) => {
    const msg = d.toString()
    if (msg.includes('error') || msg.includes('Error')) {
      console.error('[platform-api]', msg.trim())
    }
  })

  apiProcess.on('exit', () => {
    apiProcess = null
  })

  const ok = await waitForHealth(base)
  return { ok, base }
}

export function stopPlatformServer(): void {
  apiProcess?.kill()
  apiProcess = null
}
