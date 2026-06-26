import * as vscode from 'vscode'
import * as http from 'http'

const TOKEN_KEY = 'langtailor.marketplace.token'
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000

interface ProviderPick extends vscode.QuickPickItem {
  id: 'google' | 'microsoft' | 'linkedin'
}

export function getToken(context: vscode.ExtensionContext): Thenable<string | undefined> {
  return context.secrets.get(TOKEN_KEY)
}

export function clearToken(context: vscode.ExtensionContext): Thenable<void> {
  return context.secrets.delete(TOKEN_KEY)
}

function resultPage(message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>LangStitch</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0d12;color:#e6e8ee;display:flex;
align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#14171f;border:1px solid #242a36;border-radius:14px;padding:32px 40px;text-align:center}
h1{font-size:18px;margin:0 0 8px}p{color:#9aa3b2;font-size:14px;margin:0}</style></head>
<body><div class="card"><h1>LangStitch</h1><p>${message}</p></div></body></html>`
}

/**
 * Run the OAuth sign-in flow for the desktop IDE.
 *
 * Starts a loopback HTTP server, opens the system browser at the platform's
 * ``/api/auth/login/{provider}?redirect_uri=<loopback>`` endpoint, and waits for
 * the server to redirect back with a signed bearer token. The token is stored in
 * the OS secret store and returned.
 */
export async function signIn(
  context: vscode.ExtensionContext,
  apiBaseUrl: string,
): Promise<string | undefined> {
  const provider = await vscode.window.showQuickPick<ProviderPick>(
    [
      { id: 'google', label: 'Google' },
      { id: 'microsoft', label: 'Microsoft' },
      { id: 'linkedin', label: 'LinkedIn' },
    ],
    { placeHolder: 'Sign in to LangStitch with…' },
  )
  if (!provider) return undefined

  const base = apiBaseUrl.replace(/\/+$/, '')

  return await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Waiting for LangStitch sign-in…' },
    () =>
      new Promise<string | undefined>((resolve) => {
        let settled = false
        const finish = (token: string | undefined) => {
          if (settled) return
          settled = true
          try {
            server.close()
          } catch {
            /* already closing */
          }
          if (token) void context.secrets.store(TOKEN_KEY, token).then(() => resolve(token))
          else resolve(undefined)
        }

        const server = http.createServer((req, res) => {
          const url = new URL(req.url ?? '/', 'http://127.0.0.1')
          if (url.pathname !== '/callback') {
            res.writeHead(404)
            res.end()
            return
          }
          const token = url.searchParams.get('token')
          const error = url.searchParams.get('error')
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(
            resultPage(
              token
                ? 'Signed in. You can close this tab and return to LangTailor.'
                : `Sign-in failed${error ? `: ${error}` : ''}. You can close this tab.`,
            ),
          )
          finish(token ?? undefined)
        })

        server.on('error', () => finish(undefined))
        server.listen(0, '127.0.0.1', () => {
          const address = server.address()
          const port = typeof address === 'object' && address ? address.port : 0
          const redirect = `http://127.0.0.1:${port}/callback`
          const loginUrl = `${base}/api/auth/login/${provider.id}?redirect_uri=${encodeURIComponent(redirect)}`
          void vscode.env.openExternal(vscode.Uri.parse(loginUrl))
        })

        setTimeout(() => finish(undefined), SIGN_IN_TIMEOUT_MS)
      }),
  )
}
