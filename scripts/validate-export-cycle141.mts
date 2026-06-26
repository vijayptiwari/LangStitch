import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { GraphDocument, CanvasSnapshot, StitchNodeData } from '../src/types/graph'
import type { ComponentManifest } from '../src/types/component'
import { buildExportBundle } from '../src/lib/codegen/bundleGenerator'
import { generateLangsmithJson } from '../src/lib/codegen/pythonProjectGenerator'
import { exportGraphDocument, generatePythonCode } from '../src/lib/codegen/pythonGenerator'
import { validateManifest, serializeComponent, parseComponentFile } from '../src/lib/componentIO'

const OUT = join(process.cwd(), '.tmp-export-141')
rmSync(OUT, { recursive: true, force: true })

// ---- Fixture manifests ----------------------------------------------------
const httpConnector: ComponentManifest = {
  schemaVersion: '1.0',
  id: 'http_fetch',
  label: 'HTTP Fetch',
  category: 'connector',
  description: 'Fetch a URL and store the body',
  ports: [
    { id: 'in', label: 'In', side: 'left', multiplicity: 'single' },
    { id: 'out', label: 'Out', side: 'right', multiplicity: 'single' },
  ],
  configFields: [
    { id: 'url', label: 'URL', kind: 'string', defaultValue: 'https://example.com' },
    { id: 'timeout', label: 'Timeout', kind: 'number', defaultValue: 30 },
    { id: 'verify_ssl', label: 'Verify SSL', kind: 'boolean', defaultValue: true },
    { id: 'method', label: 'Method', kind: 'select', defaultValue: 'GET', options: [
      { value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' } ] },
    { id: 'headers', label: 'Headers', kind: 'json', defaultValue: '{"x":1}' },
    { id: 'api_key', label: 'API Key Env', kind: 'secret', defaultValue: 'HTTP_API_KEY' },
    { id: 'transform', label: 'Transform', kind: 'code', defaultValue: 'body = body.strip()\nreturn {"out": body}' },
  ],
  theme: { color: '#2563eb', colorLight: '#dbeafe', icon: 'globe', typeLabel: 'CONNECTOR' },
  codegen: {
    template: [
      'def {{nodeName}}(state: State) -> dict:',
      '    """{{label}} — {{description}}"""',
      '    import httpx',
      '    url = {{field.url}}',
      '    timeout = {{field.timeout}}',
      '    verify = {{field.verify_ssl}}',
      '    method = {{field.method}}',
      '    headers = {{field.headers}}',
      '    api_key = {{field.api_key}}',
      '    resp = httpx.request(method, url, timeout=timeout, verify=verify, headers=headers)',
      '    body = resp.text',
      '    {{field.transform.raw}}',
    ].join('\n'),
    imports: ['import httpx', 'from urllib.parse import urlparse'],
  },
}

// json field carrying booleans/null to probe Python-literal correctness
const jsonBoolComp: ComponentManifest = {
  schemaVersion: '1.0',
  id: 'json_bool',
  label: 'Json Bool',
  category: 'node',
  description: 'json field with bool/null',
  ports: [],
  configFields: [
    { id: 'cfg', label: 'Config', kind: 'json', defaultValue: '{"flag": true, "off": false, "none": null}' },
  ],
  theme: { color: '#16a34a', colorLight: '#dcfce7', icon: 'box', typeLabel: 'NODE' },
  codegen: {
    template: 'def {{nodeName}}(state: State) -> dict:\n    cfg = {{field.cfg}}\n    return {"cfg": cfg}',
  },
}

const asyncComp: ComponentManifest = {
  schemaVersion: '1.0',
  id: 'async_worker',
  label: 'Async Worker',
  category: 'node',
  description: 'async node',
  ports: [],
  configFields: [],
  theme: { color: '#9333ea', colorLight: '#f3e8ff', icon: 'zap', typeLabel: 'ASYNC' },
  codegen: {
    template: 'async def {{nodeName}}(state: State) -> dict:\n    return {}',
    imports: ['import asyncio'],
    async: true,
  },
}

const registry: ComponentManifest[] = [httpConnector, jsonBoolComp, asyncComp]

// ---- Build a graph document with custom nodes (+ one missing-manifest) -----
const nodes: import('@xyflow/react').Node<StitchNodeData>[] = [
  { id: 'start-1', type: 'startNode', position: { x: 0, y: 0 }, data: { kind: 'start', label: 'Start' } },
  { id: 'http-1', type: 'customNode', position: { x: 200, y: 0 }, data: {
    kind: 'custom', label: 'Fetch Page', componentId: 'http_fetch', outputKey: 'page',
    config: {
      url: 'https://api.example.com/data',
      timeout: 12,
      verify_ssl: false,
      method: 'POST',
      headers: '{"Authorization": "x", "n": 5}',
      api_key: 'MY_SECRET_ENV',
      transform: 'body = body.upper()\nreturn {"page": body}',
    },
  } },
  { id: 'jb-1', type: 'customNode', position: { x: 400, y: 0 }, data: {
    kind: 'custom', label: 'Json Bool', componentId: 'json_bool',
    config: { cfg: '{"flag": true, "off": false, "none": null}' },
  } },
  { id: 'aw-1', type: 'customNode', position: { x: 600, y: 0 }, data: {
    kind: 'custom', label: 'Async Worker', componentId: 'async_worker', config: {},
  } },
  { id: 'missing-1', type: 'customNode', position: { x: 800, y: 0 }, data: {
    kind: 'custom', label: 'Ghost', componentId: 'does_not_exist', config: {},
  } },
  { id: 'end-1', type: 'endNode', position: { x: 1000, y: 0 }, data: { kind: 'end', label: 'End' } },
]
const edges: import('@xyflow/react').Edge[] = [
  { id: 'e1', source: 'start-1', target: 'http-1' },
  { id: 'e2', source: 'http-1', target: 'jb-1' },
  { id: 'e3', source: 'jb-1', target: 'aw-1' },
  { id: 'e4', source: 'aw-1', target: 'missing-1' },
  { id: 'e5', source: 'missing-1', target: 'end-1' },
]

const doc: GraphDocument = {
  version: '1.2',
  name: 'custom_components_demo',
  description: 'Cycle-141 export validation fixture',
  stateFields: [{ id: 'sf1', name: 'messages', type: 'messages', reducer: 'append' }],
  subgraphs: [{ id: 'main', name: 'Main Graph', parentId: null, stateFields: [], nodeIds: [], edgeIds: [] }],
  activeSubgraphId: 'main',
  remoteGraphs: [],
  toolRegistry: [],
  agentRegistry: [],
  mcpServers: [],
  skillRegistry: [],
  guardrailRegistry: [],
  businessRuleRegistry: [],
  personaRegistry: [],
  ragPipelines: [],
  componentRegistry: registry,
  settings: { observability: { enabled: false } } as any,
} as any

const canvasByGraph: Record<string, CanvasSnapshot> = { main: { nodes, edges } }

// ---- 1. Manifest validation ----------------------------------------------
console.log('=== MANIFEST VALIDATION ===')
for (const m of registry) {
  const v = validateManifest(m)
  console.log(`${m.id}: errors=${JSON.stringify(v.errors)} warnings=${JSON.stringify(v.warnings)}`)
}

// ---- 2. Generate bundle ---------------------------------------------------
const projectJson = exportGraphDocument(doc, nodes, edges, canvasByGraph)
const pyCode = generatePythonCode(doc, nodes, edges, canvasByGraph)
const bundle = buildExportBundle(doc, projectJson, pyCode, 'full', nodes, edges, canvasByGraph)

console.log('\n=== BUNDLE FILE LIST (full) ===')
console.log(Object.keys(bundle).sort().join('\n'))

// write to disk
for (const [rel, content] of Object.entries(bundle)) {
  const abs = join(OUT, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

// ---- 3. langsmith.json round-trip ----------------------------------------
console.log('\n=== langsmith.json ===')
const ls = JSON.parse(generateLangsmithJson(doc))
console.log('schema_version:', ls.langstitch.schema_version)
console.log('registries.components:', JSON.stringify(ls.langstitch.registries.components))

// ---- 4. round-trip project json ------------------------------------------
const reparsed = JSON.parse(projectJson)
console.log('\n=== ROUND-TRIP ===')
console.log('componentRegistry count:', reparsed.componentRegistry?.length)
console.log('custom node count:', reparsed.canvasByGraph.main.nodes.filter((n: any) => n.data.kind === 'custom').length)
const httpNode = reparsed.canvasByGraph.main.nodes.find((n: any) => n.id === 'http-1')
console.log('http-1 config preserved:', JSON.stringify(httpNode?.data.config))

// ---- 5. portable .component.json round-trip ------------------------------
const serialized = serializeComponent(httpConnector)
const parsedBack = parseComponentFile(serialized)
console.log('\n=== .component.json ROUND-TRIP ===')
console.log('parse errors:', JSON.stringify(parsedBack.errors))
console.log('id preserved:', parsedBack.manifest?.id, 'fields:', parsedBack.manifest?.configFields.length)

// ---- 6. dump generated main.py for inspection ----------------------------
console.log('\n=== graphs/main.py (custom fns region) ===')
console.log(pyCode)

console.log('\nOUT_DIR=' + OUT)
