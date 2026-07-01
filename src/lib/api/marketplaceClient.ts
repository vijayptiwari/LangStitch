import { getApiBase, apiAuthHeaders } from './apiBase'

export type PluginKind = 'plugin' | 'connector'

export interface PluginSummary {
  slug: string
  extension_id: string
  name: string
  summary: string | null
  publisher: string
  kind: PluginKind
  category: string | null
  icon_url: string | null
  latest_version: string | null
  install_count: number
  acquired: boolean
  pinned_version?: string | null
  acquired_at?: string | null
}

export interface PluginVersion {
  version: string
  download_url: string
  sha256: string | null
  changelog: string | null
  min_ide_version: string | null
  released_at: string | null
}

export interface PluginDetail extends PluginSummary {
  description: string | null
  homepage_url: string | null
  repo_url: string | null
  source: string
  versions: PluginVersion[]
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface Submission {
  slug: string
  extension_id: string
  name: string
  summary: string | null
  description: string | null
  kind: PluginKind
  category: string | null
  status: SubmissionStatus
  version: string | null
  download_url: string | null
  homepage_url: string | null
  repo_url: string | null
  purpose: string | null
  input_schema: string | null
  output_schema: string | null
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  submitter_name: string | null
  submitter_email: string | null
  created_at: string | null
}

export interface PublishInput {
  name: string
  extension_id: string
  download_url?: string
  version?: string
  kind?: PluginKind
  summary?: string
  description?: string
  category?: string
  homepage_url?: string
  repo_url?: string
  purpose?: string
  input_schema?: string
  output_schema?: string
}

export type PublishPayload = PublishInput & { artifact?: File }

const API_UNAVAILABLE_MSG =
  'Marketplace API is not reachable. Host the platform API (FastAPI) on a server that can run Python — for example api.langstitch.com — then set PLATFORM_API_BASE in the deploy workflow.'

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(API_UNAVAILABLE_MSG)
  }
  return res.json() as Promise<T>
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders = await apiAuthHeaders()
  const res = await fetch(`${getApiBase()}${path}`, {
    credentials: 'include',
    headers: { ...authHeaders, ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await parseJsonResponse<{ detail?: string }>(res)
      message = body.detail ?? message
    } catch (e) {
      if (e instanceof Error && e.message === API_UNAVAILABLE_MSG) {
        throw e
      }
      /* fall back to status text */
    }
    throw new Error(message)
  }
  return parseJsonResponse<T>(res)
}

export interface BrowseParams {
  q?: string
  kind?: PluginKind
  category?: string
}

export const marketplaceApi = {
  browse: (params: BrowseParams = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.kind) qs.set('kind', params.kind)
    if (params.category) qs.set('category', params.category)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return request<{ plugins: PluginSummary[] }>(`/marketplace/plugins${suffix}`)
  },

  detail: (slug: string) =>
    request<{ plugin: PluginDetail }>(
      `/marketplace/plugins/${encodeURIComponent(slug)}`,
    ),

  myPlugins: () => request<{ plugins: PluginSummary[] }>(`/marketplace/my`),

  acquire: (slug: string, pinnedVersion?: string) =>
    request<{ ok: boolean; acquired: boolean }>(
      `/marketplace/plugins/${encodeURIComponent(slug)}/acquire`,
      {
        method: 'POST',
        body: JSON.stringify({ pinned_version: pinnedVersion ?? null }),
      },
    ),

  release: (slug: string) =>
    request<{ ok: boolean; acquired: boolean }>(
      `/marketplace/plugins/${encodeURIComponent(slug)}/acquire`,
      { method: 'DELETE' },
    ),

  publish: async (input: PublishPayload) => {
    if (input.artifact) {
      const fd = new FormData()
      fd.append('name', input.name.trim())
      fd.append('extension_id', input.extension_id.trim())
      fd.append('version', input.version ?? '0.1.0')
      fd.append('kind', input.kind ?? 'connector')
      if (input.summary) fd.append('summary', input.summary)
      if (input.description) fd.append('description', input.description)
      if (input.category) fd.append('category', input.category)
      if (input.homepage_url) fd.append('homepage_url', input.homepage_url)
      if (input.repo_url) fd.append('repo_url', input.repo_url)
      if (input.purpose) fd.append('purpose', input.purpose)
      if (input.input_schema) fd.append('input_schema', input.input_schema)
      if (input.output_schema) fd.append('output_schema', input.output_schema)
      fd.append('artifact', input.artifact)
      const authHeaders = await apiAuthHeaders()
      const res = await fetch(`${getApiBase()}/marketplace/publish/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders.Authorization ? { Authorization: authHeaders.Authorization } : undefined,
        body: fd,
      })
      if (!res.ok) {
        let message = res.statusText
        try {
          const contentType = res.headers.get('content-type') ?? ''
          if (contentType.includes('application/json')) {
            const body = await res.json()
            message = (body as { detail?: string }).detail ?? message
          } else {
            message = API_UNAVAILABLE_MSG
          }
        } catch {
          /* use status text */
        }
        throw new Error(message)
      }
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        throw new Error(API_UNAVAILABLE_MSG)
      }
      return res.json() as Promise<{ ok: boolean; status: SubmissionStatus; submission: Submission }>
    }
    return request<{ ok: boolean; status: SubmissionStatus; submission: Submission }>(
      `/marketplace/publish`,
      { method: 'POST', body: JSON.stringify(input) },
    )
  },

  mySubmissions: () =>
    request<{ submissions: Submission[] }>(`/marketplace/my/submissions`),

  listSubmissions: (status: SubmissionStatus | 'all' = 'pending') =>
    request<{ submissions: Submission[] }>(
      `/marketplace/submissions?status=${status}`,
    ),

  approve: (slug: string, notes?: string) =>
    request<{ ok: boolean; submission: Submission }>(
      `/marketplace/submissions/${encodeURIComponent(slug)}/approve`,
      { method: 'POST', body: JSON.stringify({ notes: notes ?? null }) },
    ),

  reject: (slug: string, notes?: string) =>
    request<{ ok: boolean; submission: Submission }>(
      `/marketplace/submissions/${encodeURIComponent(slug)}/reject`,
      { method: 'POST', body: JSON.stringify({ notes: notes ?? null }) },
    ),
}
