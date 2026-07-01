import Store from 'electron-store'

export interface LangTailorSettings {
  pythonPath: string
  outputDir: string
  serverPort: number
  imageRepository: string
  theme: 'dark' | 'light'
  telemetryEnabled: boolean
  recentProjects: string[]
  /** Desktop OAuth bearer token for marketplace / platform API. */
  authToken: string
  session: {
    viewMode: 'canvas' | 'code'
    openFiles: string[]
    layout: Record<string, unknown>
  }
}

const defaults: LangTailorSettings = {
  pythonPath: 'python',
  outputDir: '',
  serverPort: 8787,
  imageRepository: '',
  theme: 'dark',
  telemetryEnabled: false,
  recentProjects: [],
  authToken: '',
  session: { viewMode: 'canvas', openFiles: [], layout: {} },
}

export const settingsStore = new Store<LangTailorSettings>({
  name: 'langtailor-settings',
  defaults,
})

export function getSettings(): LangTailorSettings {
  return settingsStore.store
}

export function setSetting<K extends keyof LangTailorSettings>(
  key: K,
  value: LangTailorSettings[K],
): void {
  settingsStore.set(key, value)
}
