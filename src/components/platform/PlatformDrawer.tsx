import { useCallback, useEffect, useState } from 'react'
import {
  Cloud,
  Download,
  GitBranch,
  Hammer,
  History,
  TestTube2,
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
import { DEFAULT_EVAL, EVAL_PRESET_REGRESSION } from '../../lib/designerConstants'
import type { GraphDocument, StitchNodeData } from '../../types/graph'
import type { Edge, Node } from '@xyflow/react'

type Tab = 'git' | 'export' | 'import' | 'versions' | 'build' | 'deploy' | 'eval'

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
  const updateGraphSettings = useGraphStore((s) => s.updateGraphSettings)

  const [tab, setTab] = useState<Tab>('git')
  const [log, setLog] = useState('')
  const [busy, setBusy] = useState(false)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [lastHealthSync, setLastHealthSync] = useState<string | null>(null)

  const [gitUrl, setGitUrl] = useState('')
  const [gitBranch, setGitBranch] = useState('main')
  const [gitToken, setGitToken] = useState('')
  const [gitUser, setGitUser] = useState('')
  const [commitMsg, setCommitMsg] = useState('Update LangStitch graph')
  const [gitStatus, setGitStatus] = useState<string>('')

  const [exportFormat, setExportFormat] = useState<ExportFormat>(() => {
    const saved = sessionStorage.getItem(`langstitch-export-format-${projectIdFromDoc(graphDoc)}`)
    return (saved as ExportFormat) || 'full'
  })
  const [deployNs, setDeployNs] = useState('langstitch')
  const [deployRelease, setDeployRelease] = useState('')
  const [imageTag, setImageTag] = useState('latest')
  const [versions, setVersions] = useState<{ id: string; label: string; created: string }[]>([])
  const [evalResult, setEvalResult] = useState('')
  const [evalResultUrl, setEvalResultUrl] = useState<string | null>(null)
  const [evalLatencyMs, setEvalLatencyMs] = useState<number | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const projectId = projectIdFromDoc(graphDoc)
  const evalConfig = graphDoc.settings?.eval ?? DEFAULT_EVAL
  const exportEvalDatasetWarning =
    evalConfig.enabled && !evalConfig.datasetName.trim() && !evalConfig.datasetId.trim()
  const langsmithEnabled = graphDoc.settings?.observability?.langsmith?.enabled ?? false
  const observabilityEnabled = graphDoc.settings?.observability?.enabled ?? false

  useEffect(() => {
    sessionStorage.setItem(`langstitch-export-format-${projectId}`, exportFormat)
  }, [projectId, exportFormat])

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
    platformApi
      .health()
      .then(() => {
        setApiOnline(true)
        setLastHealthSync(new Date().toLocaleTimeString())
      })
      .catch(() => setApiOnline(false))
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
          nodes: r.project.nodes as Node<StitchNodeData>[] | undefined,
          edges: r.project.edges as Edge[] | undefined,
          canvasByGraph: r.project.canvasByGraph as Record<string, { nodes: Node<StitchNodeData>[]; edges: Edge[] }> | undefined,
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
    const payload = getPayload()
    const files = buildExportBundle(
      graphDoc,
      payload.projectJson,
      payload.pythonCode,
      format,
      payload.nodes,
      payload.edges,
      payload.canvasByGraph,
    )
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
    setExportError(null)
    try {
      const payload = getPayload()
      const files = buildExportBundle(
        graphDoc,
        payload.projectJson,
        payload.pythonCode,
        exportFormat,
        payload.nodes,
        payload.edges,
        payload.canvasByGraph,
      )
      const blob = await platformApi.exportBundle(projectId, exportFormat, files)
      downloadBlob(blob, `${projectId}-${exportFormat}.zip`)
      appendLog(`Exported ${exportFormat} bundle`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setExportError(msg)
      appendLog(msg)
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
        nodes: r.nodes as Node<StitchNodeData>[] | undefined,
        edges: r.edges as Edge[] | undefined,
        canvasByGraph: r.canvasByGraph as Record<string, { nodes: Node<StitchNodeData>[]; edges: Edge[] }> | undefined,
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
        nodes: r.nodes as Node<StitchNodeData>[] | undefined,
        edges: r.edges as Edge[] | undefined,
        canvasByGraph: r.canvasByGraph as Record<string, { nodes: Node<StitchNodeData>[]; edges: Edge[] }> | undefined,
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

  const patchEval = (patch: Partial<typeof evalConfig>) => {
    updateGraphSettings({
      eval: { ...evalConfig, ...patch, enabled: true },
    })
  }

  const handleRunEval = async (dryRun = false) => {
    setBusy(true)
    setEvalResult('')
    setEvalResultUrl(null)
    setEvalLatencyMs(null)
    try {
      const payload = getPayload()
      await platformApi.saveProject(projectId, {
        document: payload.document as unknown as Record<string, unknown>,
        nodes: payload.nodes,
        edges: payload.edges,
        canvasByGraph: payload.canvasByGraph,
        navigationPath: payload.navigationPath,
      })
      const obs = graphDoc.settings?.observability
      const res = await platformApi.runEval({
        project_id: projectId,
        eval_config: {
          enabled: true,
          dataset_name: evalConfig?.datasetName ?? '',
          dataset_id: evalConfig?.datasetId ?? '',
          experiment_prefix: evalConfig?.experimentPrefix ?? graphDoc.name,
          max_concurrency: evalConfig?.maxConcurrency ?? 2,
          description: evalConfig?.description ?? '',
        },
        langsmith_project: obs?.langsmith?.projectName ?? graphDoc.name,
        api_key_env: obs?.langsmith?.apiKeyEnv ?? 'LANGCHAIN_API_KEY',
        dry_run: dryRun,
      })
      const msg = res.message ?? (dryRun ? 'Config validated' : 'Eval complete')
      setEvalResult(msg)
      setEvalResultUrl(res.url ?? null)
      setEvalLatencyMs(res.latency_ms ?? null)
      appendLog(dryRun ? `Eval dry-run: ${msg}` : `Eval: ${msg}`)
    } catch (e) {
      const err = String(e)
      setEvalResult(err)
      appendLog(err)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const tabs: { id: Tab; label: string; icon: typeof GitBranch; testId?: string }[] = [
    { id: 'git', label: 'Git', icon: GitBranch },
    { id: 'export', label: 'Export', icon: Download },
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'eval', label: 'Eval', icon: TestTube2, testId: 'platform-tab-eval' },
    { id: 'versions', label: 'Versions', icon: History },
    { id: 'build', label: 'Build', icon: Hammer },
    { id: 'deploy', label: 'Deploy', icon: Cloud, testId: 'platform-tab-deploy' },
  ]

  return (
    <div className="platform-overlay" onClick={onClose} role="presentation">
      <div className="platform-drawer" data-testid="platform-drawer" onClick={(e) => e.stopPropagation()} role="dialog">
        <header className="platform-header">
          <div>
            <h2>Platform</h2>
            <p>
              Project: <code>{projectId}</code>
              {apiOnline === false && <span className="platform-badge warn">API offline</span>}
              {apiOnline === true && <span className="platform-badge ok">API online</span>}
            </p>
            {apiOnline === true && lastHealthSync && (
              <p className="platform-health-sync" data-testid="platform-health-last-sync">
                Platform Health · Last sync: {lastHealthSync}
              </p>
            )}
          </div>
          <button className="btn-icon" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <nav className="platform-tabs">
          {tabs.map(({ id, label, icon: Icon, testId }) => (
            <button
              key={id}
              type="button"
              data-testid={testId}
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
              {exportEvalDatasetWarning && (
                <p className="platform-hint warn" data-testid="export-eval-dataset-warning">
                  Eval is enabled but no dataset name or ID is configured. Export will omit eval-dataset metadata.
                </p>
              )}
              <Field label="Format">
                <select className="input" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)}>
                  <option value="python">Python (LangGraph + FastAPI)</option>
                  <option value="spring">Spring Boot (API gateway)</option>
                  <option value="full">Full (Python + Spring + Docker + Helm)</option>
                </select>
              </Field>
              {exportError && (
                <div className="platform-export-error" data-testid="export-error">
                  <p>{exportError}</p>
                  <button
                    className="btn-secondary"
                    type="button"
                    data-testid="export-retry"
                    disabled={busy}
                    onClick={handleExport}
                  >
                    Retry export
                  </button>
                </div>
              )}
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

          {tab === 'eval' && (
            <div className="platform-section" data-testid="eval-panel">
              <p className="platform-hint">
                Run LangSmith dataset evals against this graph. Evaluators stay in LangSmith UI; config exports with your project.
              </p>
              {!observabilityEnabled || !langsmithEnabled ? (
                <p className="platform-hint warn" data-testid="eval-disabled-hint">
                  Enable LangSmith under Graph Designer → Observability before running evals.
                </p>
              ) : (
                <>
                  <div className="platform-actions">
                    <button
                      className="btn-secondary-sm"
                      type="button"
                      data-testid="eval-preset-regression"
                      disabled={busy}
                      onClick={() =>
                        patchEval({
                          enabled: true,
                          datasetName: EVAL_PRESET_REGRESSION.datasetName,
                          datasetId: EVAL_PRESET_REGRESSION.datasetId,
                          experimentPrefix: EVAL_PRESET_REGRESSION.experimentPrefix,
                          maxConcurrency: EVAL_PRESET_REGRESSION.maxConcurrency,
                          description: EVAL_PRESET_REGRESSION.description,
                        })
                      }
                    >
                      Apply regression preset
                    </button>
                  </div>
                  <Field label="Dataset name">
                    <input
                      className="input"
                      data-testid="eval-dataset-name"
                      value={evalConfig?.datasetName ?? ''}
                      onChange={(e) => patchEval({ datasetName: e.target.value })}
                      placeholder="my-regression-dataset"
                    />
                  </Field>
                  <Field label="Dataset ID (optional)">
                    <input
                      className="input"
                      data-testid="eval-dataset-id"
                      value={evalConfig?.datasetId ?? ''}
                      onChange={(e) => patchEval({ datasetId: e.target.value })}
                      placeholder="uuid-from-langsmith"
                    />
                  </Field>
                  <Field label="Experiment prefix">
                    <input
                      className="input"
                      data-testid="eval-experiment-prefix"
                      value={evalConfig?.experimentPrefix ?? ''}
                      onChange={(e) => patchEval({ experimentPrefix: e.target.value })}
                      placeholder={graphDoc.name}
                    />
                  </Field>
                  <Field label="Max concurrency">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={8}
                      value={evalConfig?.maxConcurrency ?? 2}
                      onChange={(e) =>
                        patchEval({ maxConcurrency: Math.min(8, Math.max(1, Number(e.target.value) || 2)) })
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      className="input"
                      value={evalConfig?.description ?? ''}
                      onChange={(e) => patchEval({ description: e.target.value })}
                      placeholder="Optional experiment note"
                    />
                  </Field>
                  <div className="platform-actions">
                    <button
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => handleRunEval(true)}
                      type="button"
                    >
                      Validate config
                    </button>
                    <button
                      className="btn-primary"
                      data-testid="eval-run-button"
                      disabled={busy || !(evalConfig?.datasetName || evalConfig?.datasetId)}
                      onClick={() => handleRunEval(false)}
                      type="button"
                    >
                      <TestTube2 size={14} /> Run eval
                    </button>
                  </div>
                  {evalResult && (
                    <p className="platform-status" data-testid="eval-result">
                      {evalResult}
                      {evalLatencyMs != null && (
                        <>
                          {' '}
                          <span data-testid="eval-result-latency">({evalLatencyMs} ms)</span>
                        </>
                      )}
                      {evalResultUrl && (
                        <>
                          {' '}
                          <a
                            href={evalResultUrl}
                            target="_blank"
                            rel="noreferrer"
                            data-testid="eval-result-link"
                          >
                            Open LangSmith
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </>
              )}
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
            <div className="platform-section" data-testid="deploy-panel">
              {busy && (
                <div className="platform-skeleton" data-testid="deploy-tab-skeleton" aria-hidden>
                  <div className="skeleton-line" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line" />
                  <div className="skeleton-block" />
                </div>
              )}
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
