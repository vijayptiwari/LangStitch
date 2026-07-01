import { BrowserWindow } from 'electron'

const COMPANY = 'LangStitch'
const PRODUCT = 'LangTailor'
const TAGLINE = 'Visual LangGraph IDE'

/** Standalone splash markup (loaded as a data URL so it needs no packaging). */
function splashHtml(version: string): string {
  const year = new Date().getFullYear()
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%; height: 100%; overflow: hidden;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #e6e8f0; user-select: none;
  }
  .splash {
    position: relative; width: 100vw; height: 100vh;
    background:
      radial-gradient(1200px 600px at 80% -10%, rgba(124,58,237,0.45), transparent 60%),
      radial-gradient(900px 500px at -10% 110%, rgba(79,70,229,0.50), transparent 55%),
      linear-gradient(135deg, #0b1020 0%, #141a33 100%);
    border: 1px solid rgba(255,255,255,0.08);
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 30px 34px;
  }
  .top { display: flex; align-items: center; gap: 16px; }
  .logo { width: 56px; height: 56px; flex: none; filter: drop-shadow(0 6px 16px rgba(99,102,241,0.45)); }
  .brand { display: flex; flex-direction: column; }
  .product { font-size: 34px; font-weight: 700; letter-spacing: 0.5px; line-height: 1; }
  .tagline { margin-top: 7px; font-size: 13px; color: #aab0c6; font-weight: 500; }
  .company { position: absolute; top: 30px; right: 34px; font-size: 12px; color: #8b91aa; letter-spacing: 0.4px; }
  .bottom { display: flex; flex-direction: column; gap: 12px; }
  .bar { position: relative; height: 4px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden; }
  .bar::after {
    content: ''; position: absolute; top: 0; left: -40%; height: 100%; width: 40%;
    background: linear-gradient(90deg, transparent, #818cf8, #c4b5fd, transparent);
    animation: slide 1.3s ease-in-out infinite;
  }
  @keyframes slide { 0% { left: -45%; } 100% { left: 105%; } }
  .row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
  .status { color: #c7cbe0; }
  .meta { color: #7e84a0; }
  .copyright { font-size: 11px; color: #676d88; }
</style>
</head>
<body>
  <div class="splash">
    <div class="company">${COMPANY}</div>
    <div class="top">
      <svg class="logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#g)" />
        <circle cx="10" cy="11" r="2.4" fill="#c7d2fe" />
        <circle cx="22" cy="11" r="2.4" fill="#a5b4fc" />
        <circle cx="16" cy="22" r="2.4" fill="#818cf8" />
        <path d="M10 11 C 13 16, 19 16, 22 11" stroke="#e0e7ff" stroke-width="1.6" stroke-linecap="round" fill="none" />
        <path d="M10 11 L 16 22 L 22 11" stroke="#eef2ff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.55" />
        <defs>
          <linearGradient id="g" x1="2" y1="2" x2="30" y2="30">
            <stop stop-color="#4f46e5" /><stop offset="1" stop-color="#7c3aed" />
          </linearGradient>
        </defs>
      </svg>
      <div class="brand">
        <div class="product">${PRODUCT}</div>
        <div class="tagline">${TAGLINE}</div>
      </div>
    </div>
    <div class="bottom">
      <div class="bar"></div>
      <div class="row">
        <span class="status" id="status">Starting…</span>
        <span class="meta">v${version}</span>
      </div>
      <div class="copyright">© ${year} ${COMPANY}. All rights reserved.</div>
    </div>
  </div>
  <script>
    window.setStatus = function (text) {
      var el = document.getElementById('status');
      if (el) el.textContent = text;
    };
  </script>
</body>
</html>`
}

export function createSplashWindow(version: string): BrowserWindow {
  const splash = new BrowserWindow({
    width: 520,
    height: 300,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#0b1020',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  void splash.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml(version)),
  )
  splash.once('ready-to-show', () => splash.show())
  return splash
}

/** Update the splash status line (best-effort; ignores a closed window). */
export function setSplashStatus(splash: BrowserWindow | null, text: string): void {
  if (!splash || splash.isDestroyed()) return
  splash.webContents
    .executeJavaScript(`window.setStatus && window.setStatus(${JSON.stringify(text)})`)
    .catch(() => {})
}
