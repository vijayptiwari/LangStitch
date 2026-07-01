import { getApiBase, apiAuthHeaders } from './apiBase'

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const authHeaders = await apiAuthHeaders()
  const res = await fetch(`${getApiBase()}${path}`, {
    credentials: 'include',
    headers: { ...authHeaders, ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.text()
    let message = err || res.statusText
    if (res.status === 429) {
      try {
        const parsed = JSON.parse(err) as { detail?: string }
        message = parsed.detail ?? message
      } catch {
        /* use raw text */
      }
    }
    throw new Error(message)
  }
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) return res.json() as Promise<T>
  return res as unknown as T
}

export interface GitStatus {
  initialized: boolean
  branch: string | null
  clean: boolean
  files: string[]
  recent_commits?: string[]
}

export interface ProjectData {
  document: Record<string, unknown>
  nodes: unknown[]
  edges: unknown[]
  canvasByGraph?: Record<string, unknown>
  navigationPath?: string[]
}

export const platformApi = {
  health: () =>
    request<{
      status: string
      version?: string
      python?: string
      build_time?: string
      langsmith_api_key_configured?: boolean
    }>('/health'),

  saveProject: (projectId: string, payload: ProjectData) =>
    request<{ ok: boolean; path: string }>('/project/save', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, ...payload }),
    }),

  gitConnect: (body: {
    project_id: string
    remote_url?: string
    branch?: string
    username?: string
    token?: string
  }) =>
    request<{ ok: boolean; status: string }>('/git/connect', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  gitStatus: (projectId: string) =>
    request<GitStatus>(`/git/status/${encodeURIComponent(projectId)}`),

  gitSync: (projectId: string, strategy = 'pull') =>
    request<{ ok: boolean; project: ProjectData | null }>('/git/sync', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, strategy }),
    }),

  gitCommit: (projectId: string, message: string) =>
    request<{ ok: boolean; commit: string }>('/git/commit', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, message }),
    }),

  gitPush: (projectId: string) =>
    request<{ ok: boolean }>('/git/push', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    }),

  writeProjectFiles: (projectId: string, format: string, files: Record<string, string>) =>
    request<{ ok: boolean }>('/project/files', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, format, files }),
    }),

  exportBundle: async (
    projectId: string,
    format: string,
    files: Record<string, string>,
  ) => {
    const authHeaders = await apiAuthHeaders()
    const res = await fetch(`${getApiBase()}/export`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders,
      body: JSON.stringify({ project_id: projectId, format, files }),
    })
    if (!res.ok) {
      const err = await res.text()
      let message = err || res.statusText
      if (res.status === 429) {
        try {
          const parsed = JSON.parse(err) as { detail?: string }
          message = parsed.detail ?? message
        } catch {
          /* use raw text */
        }
      }
      throw new Error(message)
    }
    return res.blob()
  },

  importProject: async (projectId: string, file: File, format = 'langstitch') => {
    const fd = new FormData()
    fd.append('file', file)
    const authHeaders = await apiAuthHeaders()
    const res = await fetch(
      `${getApiBase()}/import?project_id=${encodeURIComponent(projectId)}&format=${format}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders.Authorization ? { Authorization: authHeaders.Authorization } : undefined,
        body: fd,
      },
    )
    if (!res.ok) throw new Error(await res.text())
    return res.json() as Promise<ProjectData & { ok: boolean }>
  },

  snapshotVersion: (projectId: string, label?: string) =>
    request<{ ok: boolean; version_id: string }>('/versions/snapshot', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, label }),
    }),

  listVersions: (projectId: string) =>
    request<{ versions: { id: string; created: string; label: string }[] }>(
      `/versions/${encodeURIComponent(projectId)}`,
    ),

  restoreVersion: (projectId: string, versionId: string) =>
    request<ProjectData & { ok: boolean }>(
      `/versions/${encodeURIComponent(projectId)}/restore/${encodeURIComponent(versionId)}`,
      { method: 'POST' },
    ),

  build: (projectId: string, target: 'python' | 'spring' | 'all') =>
    request<{ ok: boolean; built: string[]; logs: string }>('/build', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, target }),
    }),

  deployHelm: (body: {
    project_id: string
    release_name?: string
    namespace?: string
    image_tag?: string
    dry_run?: boolean
  }) =>
    request<{ ok: boolean; release: string; output: string }>('/deploy/helm', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  runAgent: (projectId: string, pythonCode?: string) =>
    request<{
      ok: boolean
      exit_code: number
      stdout: string
      stderr: string
      result: Record<string, unknown> | null
      graph_path: string
    }>('/agent/run', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, python_code: pythonCode }),
    }),

  runEval: (body: {
    project_id: string
    eval_config: {
      enabled: boolean
      dataset_name: string
      dataset_id: string
      experiment_prefix: string
      max_concurrency: number
      description: string
    }
    langsmith_project: string
    api_key_env: string
    dry_run?: boolean
  }) =>
    request<{
      ok: boolean
      dry_run?: boolean
      experiment_id?: string
      url?: string
      message?: string
      latency_ms?: number
      pass_rate?: number
    }>('/eval/run', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
