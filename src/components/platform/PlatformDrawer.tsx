import { useCallback, useEffect, useState } from 'react'
import {
  Cloud,
  Download,
  GitBranch,
  Hammer,
  History,
  Upload,
  X,
} from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import {
  exportGraphDocument,
  generatePythonCode,
} from '../../lib/codegen/pythonGenerator'
import {
  buildExportBundle,
  type ExportFormat,
} from '../../lib/codegen/bundleGenerator'
import { platformApi, downloadBlob } from '../../lib/api/platformClient'
import type { GraphDocument, LGNodeData } from '../../types/graph'
import type { Edge, Node } from '@xyflow/react'

type Tab = 'git' | 'export' | 'import' | 'versions' | 'build' | 'deploy'

interface PlatformDrawerProps {
  open: boolean
  onClose: () => void
}

function projectIdFromDoc(doc: GraphDocument): string {
  return (doc.name || 'my_langgraph').replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function PlatformDrawer({ open, onClose }: PlatformDrawerProps) {
  const graphDoc = useGraphStore((s) => s.document)
  const getProjectPayload = useGraphStore((s) => s.getProjectPayload)
  const loadProject = useGraphStore((s) => s.loadProject)

  const [tab, setTab] = useState<Tab>('git')
  const [log, setLog] = useState('')
  const [busy, setBusy] = useState(false)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)

  const [gitUrl, setGitUrl] = useState('')
  const [gitBranch, setGitBranch] = useState('main')
  const [gitToken, setGitToken] = useState('')
  const [gitUser, setGitUser] = useState('')
  const [commitMsg, setCommitMsg] = useState('Update LangStitch graph')
  const [gitStatus, setGitStatus] = useState<string>('')

  const [exportFormat, setExportFormat] = useState<ExportFormat>('full')
  const [deployNs, setDeployNs] = useState('langstitch')
  const [deployRelease, setDeployRelease] = useState('')
  const [imageTag, setImageTag] = useState('latest')
  const [versions, setVersions] = useState<{ id: string; label: string; created: string }[]>([])

  const projectId = projectIdFromDoc(graphDoc)

  const appendLog = (msg: string) => setLog((l) => `${l}\n${msg}`.trim())

  const getPayload = useCallback(() => {
    const payload = getProjectPayload()
    const projectJson = exportGraphDocument(
      payload.document,
      payload.nodes,
      payload.edges,
      payload.canvasByGraph,
      payload.navigationPath,
    )
    const pythonCode = generatePythonCode(
      payload.document,
      payload.nodes,
      payload.edges,
      payload.canvasByGraph,
    )
    return {
      document: payload.document,
      nodes: payload.nodes,
      edges: payload.edges,
      canvasByGraph: payload.canvasByGraph,
      navigationPath: payload.navigationPath,
      projectJson,
      pythonCode,
    }
  }, [getProjectPayload])

  const refreshGitStatus = useCallback(async () => {
    try {
      const s = await platformApi.gitStatus(projectId)
      setGitStatus(
        s.initialized
          ? `Branch: ${s.branch} · ${s.clean ? 'clean' : `${s.files.length} changed`}`
          : 'Not connected',
      )
    } catch {
      setGitStatus('Platform API offline')
    }
  }, [projectId])

  useEffect(() => {
    if (!open) return
    platformApi.health().then(() => setApiOnline(true)).catch(() => setApiOnline(false))
    refreshGitStatus()
  }, [open, refreshGitStatus])

  const saveToWorkspace = async () => {
    const payload = getPayload()
    await platformApi.saveProject(projectId, {
      document: payload.document as unknown as Record<string, unknown>,
      nodes: payload.nodes,
      edges: payload.edges,
      canvasByGraph: payload.canvasByGraph,
      navigationPath: payload.navigationPath,
    })
  }

  const handleGitConnect = async () => {
    setBusy(true)
    try {
      await saveToWorkspace()
      const r = await platformApi.gitConnect({
        project_id: projectId,
        remote_url: gitUrl || undefined,
        branch: gitBranch,
        username: gitUser || undefined,
        token: gitToken || undefined,
      })
      appendLog(`Git connected: ${r.status}`)
      await refreshGitStatus()
    } catch (e) {
      appendLog(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleGitSync = async () => {
    setBusy(true)
    try {
      await saveToWorkspace()
      const r = await platformApi.gitSync(projectId)
      if (r.project) {
        loadProject({
          document: r.project.document as unknown as GraphDocument,
          nodes: r.project.nodes as Node<LGNodeData>[] | undefined,
          edges: r.project.edges as Edge[] | undefined,
          canvasByGraph: r.project.canvasByGraph as Record<string, { nodes: Node<LGNodeData>[]; edges: Edge[] }> | undefined,
          navigationPath: r.project.navigationPath as string[] | undefined,
        })
        appendLog('Synced from git — canvas updated')
      } else {
        appendLog('Pulled from remote (no project file in repo)')
      }
      await refreshGitStatus()
    } catch (e) {
      appendLog(String(e))
    } finally {
      setBusy(false)
    }
  }

  const writeWorkspace = async (format: ExportFormat = 'full') => {
    const { projectJson, pythonCode } = getPayload()
    const files = buildExportBundle(graphDoc, projectJson, pythonCode, format)
    await platformApi.writeProjectFiles(projectId, format, files)
  }

  const handleGitCommitPush = async () => {
    setBusy(true)
    try {
      await saveToWorkspace()
      await writeWorkspace('full')
      await platformApi.gitCommit(projectId, commitMsg)
      appendLog('Committed locally')
      if (gitUrl) {
        await platformApi.gitPush(projectId)
        appendLog('Pushed to remote')
      }
      await refreshGitStatus()
    } catch (e) {
      appendLog(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async () => {
    setBusy(true)
    try {
      const { projectJson, pythonCode } = getPayload()
      const files = buildExportBundle(graphDoc, projectJson, pythonCode, exportFormat)
      const blob = await platformApi.exportBundle(projectId, exportFormat, files)
      downloadBlob(blob, `${projectId}-${exportFormat}.zip`)
      appendLog(`Exported ${exportFormat} bundle`)
    } catch (e) {
      appendLog(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (file: File) => {
    setBusy(true)
    try {
      const fmt = file.name.endsWith('.py') ? 'python' : 'langstitch'
      const r = await platformApi.importProject(projectId, file, fmt)
      loadProject({
        document: r.document as unknown as GraphDocument,
        nodes: r.nodes as Node<LGNodeData>[] | undefined,
        edges: r.edges as Edge[] | undefined,
        canvasByGraph: r.canvasByGraph as Record<string, { nodes: Node<LGNodeData>[]; edges: Edge[] }> | undefined,
        navigationPath: r.navigationPath as string[] | undefined,
      })
      appendLog(`Imported ${file.name}`)
    } catch (e) {
      appendLog(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleSnapshot = async () => {
    setBusy(true)
    try {
      await saveToWorkspace()
      const r = await platformApi.snapshotVersion(projectId)
      appendLog(`Snapshot: ${r.version_id}`)
      const list = await platformApi.listVersions(projectId)
      setVersions(list.versions)
    } catch (e) {
      appendLog(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (versionId: string) => {
    setBusy(true)
    try {
      const r = await platformApi.restoreVersion(projectId, versionId)
      loadProject({
        document: r.document as unknown as GraphDocument,
        nodes: r.nodes as Node<LGNodeData>[] | undefined,
        edges: r.edges as Edge[] | undefined,
        canvasByGraph: r.canvasByGraph as Record<string, { nodes: Node<LGNodeData>[]; edges: Edge[] }> | undefined,
        navigationPath: r.navigationPath as string[] | undefined,
      })
      appendLog(`Restored ${versionId}`)
    } catch (e) {
      appendLog(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleBuild = async (target: 'python' | 'spring' | 'all') => {
    setBusy(true)
    try {
      await saveToWorkspace()
      await writeWorkspace('full')
      const r = await platformApi.build(projectId, target)
      appendLog(r.logs || `Built: ${r.built.join(', ')}`)
    } catch (e) {
      appendLog(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDeploy = async (dryRun: boolean) => {
    setBusy(true)
    try {
      await saveToWorkspace()
      await writeWorkspace('full')
      const r = await platformApi.deployHelm({
        project_id: projectId,
        release_name: deployRelease || projectId,
        namespace: deployNs,
        image_tag: imageTag,
        dry_run: dryRun,
      })
      appendLog(r.output || `Deployed release ${r.release}`)
    } catch (e) {
      appendLog(String(e))
    } finally {
      setBusy(false)
    }
  }

  const loadVersions = async () => {
    try {
      const list = await platformApi.listVersions(projectId)
      setVersions(list.versions)
    } catch (e) {
      appendLog(String(e))
    }
  }

  if (!open) return null

  const tabs: { id: Tab; label: string; icon: typeof GitBranch }[] = [
    { id: 'git', label: 'Git', icon: GitBranch },
    { id: 'export', label: 'Export', icon: Download },
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'versions', label: 'Versions', icon: History },
    { id: 'build', label: 'Build', icon: Hammer },
    { id: 'deploy', label: 'Deploy', icon: Cloud },
  ]

  return (
    <div className="platform-overlay" onClick={onClose} role="presentation">
      <div className="platform-drawer" onClick={(e) => e.stopPropagation()} role="dialog">
        <header className="platform-header">
          <div>
            <h2>Platform</h2>
            <p>
              Project: <code>{projectId}</code>
              {apiOnline === false && <span className="platform-badge warn">API offline</span>}
              {apiOnline === true && <span className="platform-badge ok">API online</span>}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <nav className="platform-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`platform-tab ${tab === id ? 'active' : ''}`}
              onClick={() => {
                setTab(id)
                if (id === 'versions') loadVersions()
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>

        <div className="platform-body">
          {tab === 'git' && (
            <div className="platform-section">
              <p className="platform-hint">Connect a git remote, sync pulls, commit & push exports full project.</p>
              <Field label="Remote URL">
                <input className="input" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} placeholder="https://github.com/you/repo.git" />
              </Field>
              <Field label="Branch">
                <input className="input" value={gitBranch} onChange={(e) => setGitBranch(e.target.value)} />
              </Field>
              <Field label="Username (optional)">
                <input className="input" value={gitUser} onChange={(e) => setGitUser(e.target.value)} />
              </Field>
              <Field label="Token / PAT (optional)">
                <input className="input" type="password" value={gitToken} onChange={(e) => setGitToken(e.target.value)} />
              </Field>
              <Field label="Commit message">
                <input className="input" value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} />
              </Field>
              <p className="platform-status">{gitStatus}</p>
              <div className="platform-actions">
                <button className="btn-primary" disabled={busy} onClick={handleGitConnect} type="button">Connect / Init</button>
                <button className="btn-secondary" disabled={busy} onClick={handleGitSync} type="button">Resync (Pull)</button>
                <button className="btn-secondary" disabled={busy} onClick={handleGitCommitPush} type="button">Commit & Push</button>
              </div>
            </div>
          )}

          {tab === 'export' && (
            <div className="platform-section">
              <p className="platform-hint">Export as Python LangGraph, Spring Boot gateway, or full bundle with Helm chart.</p>
              <Field label="Format">
                <select className="input" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)}>
                  <option value="python">Python (LangGraph + FastAPI)</option>
                  <option value="spring">Spring Boot (API gateway)</option>
                  <option value="full">Full (Python + Spring + Docker + Helm)</option>
                </select>
              </Field>
              <button className="btn-primary" disabled={busy} onClick={handleExport} type="button">
                <Download size={14} /> Download ZIP
              </button>
            </div>
          )}

          {tab === 'import' && (
            <div className="platform-section">
              <p className="platform-hint">Import .langstitch.json or exported ZIP bundle. Python import requires bundled project JSON.</p>
              <label className="import-drop">
                <Upload size={20} />
                <span>Drop file or click to import</span>
                <input
                  type="file"
                  accept=".json,.zip,.py,.langstitch.json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleImport(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          )}

          {tab === 'versions' && (
            <div className="platform-section">
              <p className="platform-hint">Local version snapshots stored in workspace (independent of git tags).</p>
              <button className="btn-primary" disabled={busy} onClick={handleSnapshot} type="button">Create snapshot</button>
              <ul className="version-list">
                {versions.map((v) => (
                  <li key={v.id}>
                    <span>{v.label || v.id}</span>
                    <button className="btn-secondary-sm" type="button" onClick={() => handleRestore(v.id)}>Restore</button>
                  </li>
                ))}
                {versions.length === 0 && <li className="muted">No snapshots yet</li>}
              </ul>
            </div>
          )}

          {tab === 'build' && (
            <div className="platform-section">
              <p className="platform-hint">Build Docker images (requires Docker daemon + platform API).</p>
              <div className="platform-actions">
                <button className="btn-secondary" disabled={busy} onClick={() => handleBuild('python')} type="button">Build Python</button>
                <button className="btn-secondary" disabled={busy} onClick={() => handleBuild('spring')} type="button">Build Spring</button>
                <button className="btn-primary" disabled={busy} onClick={() => handleBuild('all')} type="button">Build All</button>
              </div>
            </div>
          )}

          {tab === 'deploy' && (
            <div className="platform-section">
              <p className="platform-hint">Deploy to Kubernetes cluster via Helm (requires helm + kubectl configured on API host).</p>
              <Field label="Release name">
                <input className="input" value={deployRelease} onChange={(e) => setDeployRelease(e.target.value)} placeholder={projectId} />
              </Field>
              <Field label="Namespace">
                <input className="input" value={deployNs} onChange={(e) => setDeployNs(e.target.value)} />
              </Field>
              <Field label="Image tag">
                <input className="input" value={imageTag} onChange={(e) => setImageTag(e.target.value)} />
              </Field>
              <div className="platform-actions">
                <button className="btn-secondary" disabled={busy} onClick={() => handleDeploy(true)} type="button">Dry run</button>
                <button className="btn-primary" disabled={busy} onClick={() => handleDeploy(false)} type="button">
                  <Cloud size={14} /> Helm deploy
                </button>
              </div>
            </div>
          )}

          {log && (
            <pre className="platform-log">{log}</pre>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
