import { create } from 'zustand'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import type {
  AgentDefinition,
  BusinessRuleDefinition,
  CanvasSnapshot,
  GraphDocument,
  GraphSettings,
  GuardrailDefinition,
  StitchNodeData,
  McpServerDefinition,
  PersonaDefinition,
  RagPipelineConfig,
  RemoteGraphRef,
  SkillDefinition,
  StateField,
  ToolDefinition,
} from '../types/graph'
import { createDefaultDocument, createSubgraph } from '../lib/codegen/pythonGenerator'
import { DEFAULT_GRAPH_SETTINGS, mergeGraphSettings } from '../lib/designerConstants'
import { getNodeTheme } from '../lib/nodeTheme'
import {
  createEmptySubgraphCanvas,
  MAIN_GRAPH_ID,
  syncCanvas,
} from '../lib/subgraphCanvas'
import { saveViewport } from '../lib/viewportStorage'

function styledEdge(
  id: string,
  source: string,
  target: string,
  sourceKind: StitchNodeData['kind'],
  sourceHandle?: string,
): Edge {
  const color = getNodeTheme(sourceKind).edgeColor
  return {
    id,
    source,
    target,
    sourceHandle,
    animated: true,
    style: { stroke: color, strokeWidth: 2.5 },
  }
}

function buildPathToGraph(
  graphId: string,
  subgraphs: GraphDocument['subgraphs'],
): string[] {
  const path: string[] = []
  let current: string | null = graphId
  while (current) {
    path.unshift(current)
    const sg = subgraphs.find((s) => s.id === current)
    current = sg?.parentId ?? null
  }
  return path.length ? path : [MAIN_GRAPH_ID]
}

function persistActiveCanvas(state: {
  canvasByGraph: Record<string, CanvasSnapshot>
  document: GraphDocument
  nodes: Node<StitchNodeData>[]
  edges: Edge[]
}) {
  const id = state.document.activeSubgraphId
  return syncCanvas(state.canvasByGraph, id, state.nodes, state.edges)
}

interface GraphStore {
  document: GraphDocument
  canvasByGraph: Record<string, CanvasSnapshot>
  navigationPath: string[]
  nodes: Node<StitchNodeData>[]
  edges: Edge[]
  selectedNodeId: string | null
  showCodePanel: boolean
  designerTab: 'node' | 'graph' | 'assets'

  setNodes: (nodes: Node<StitchNodeData>[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (changes: NodeChange<Node<StitchNodeData>>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (node: Node<StitchNodeData>) => void
  updateNodeData: (nodeId: string, data: Partial<StitchNodeData>) => void
  removeNode: (nodeId: string) => void
  selectNode: (nodeId: string | null) => void
  toggleCodePanel: () => void

  setDocumentMeta: (meta: Partial<Pick<GraphDocument, 'name' | 'description'>>) => void
  updateGraphSettings: (settings: Partial<GraphSettings>) => void
  setDesignerTab: (tab: 'node' | 'graph' | 'assets') => void
  addStateField: (field: StateField) => void
  updateStateField: (id: string, field: Partial<StateField>) => void
  removeStateField: (id: string) => void

  addSubgraph: (name: string) => string
  navigateToGraph: (graphId: string) => void
  enterSubgraph: (graphId: string) => void
  zoomOutSubgraph: () => void
  addRemoteGraph: (ref: RemoteGraphRef) => void
  updateRemoteGraph: (id: string, ref: Partial<RemoteGraphRef>) => void
  removeRemoteGraph: (id: string) => void

  addToolDefinition: (tool: ToolDefinition) => void
  updateToolDefinition: (id: string, tool: Partial<ToolDefinition>) => void
  removeToolDefinition: (id: string) => void
  addAgentDefinition: (agent: AgentDefinition) => void
  updateAgentDefinition: (id: string, agent: Partial<AgentDefinition>) => void
  removeAgentDefinition: (id: string) => void
  addMcpServer: (server: McpServerDefinition) => void
  updateMcpServer: (id: string, server: Partial<McpServerDefinition>) => void
  removeMcpServer: (id: string) => void

  addSkillDefinition: (skill: SkillDefinition) => void
  updateSkillDefinition: (id: string, skill: Partial<SkillDefinition>) => void
  removeSkillDefinition: (id: string) => void
  addGuardrailDefinition: (guardrail: GuardrailDefinition) => void
  updateGuardrailDefinition: (id: string, guardrail: Partial<GuardrailDefinition>) => void
  removeGuardrailDefinition: (id: string) => void
  addBusinessRuleDefinition: (rule: BusinessRuleDefinition) => void
  updateBusinessRuleDefinition: (id: string, rule: Partial<BusinessRuleDefinition>) => void
  removeBusinessRuleDefinition: (id: string) => void
  addPersonaDefinition: (persona: PersonaDefinition) => void
  updatePersonaDefinition: (id: string, persona: Partial<PersonaDefinition>) => void
  removePersonaDefinition: (id: string) => void
  addRagPipeline: (pipeline: RagPipelineConfig) => void
  updateRagPipeline: (id: string, pipeline: Partial<RagPipelineConfig>) => void
  removeRagPipeline: (id: string) => void

  getProjectPayload: () => {
    document: GraphDocument
    canvasByGraph: Record<string, CanvasSnapshot>
    navigationPath: string[]
    nodes: Node<StitchNodeData>[]
    edges: Edge[]
  }

  loadProject: (payload: {
    document: GraphDocument
    nodes?: Node<StitchNodeData>[]
    edges?: Edge[]
    canvasByGraph?: Record<string, CanvasSnapshot>
    navigationPath?: string[]
  }) => void
  resetProject: () => void
  redoProject: () => void
  canRedo: () => boolean
  updateViewport: (viewport: { x: number; y: number; zoom: number }) => void
}

const initialNodes: Node<StitchNodeData>[] = [
  {
    id: 'start-1',
    type: 'startNode',
    position: { x: 40, y: 220 },
    data: { kind: 'start', label: 'Start' },
    deletable: false,
  },
  {
    id: 'llm-1',
    type: 'llmNode',
    position: { x: 240, y: 200 },
    data: {
      kind: 'llm',
      label: 'Assistant',
      model: 'gpt-4o-mini',
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'User message: {input}',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      outputKey: 'messages',
      boundToolIds: [],
      boundAgentIds: [],
    },
  },
  {
    id: 'decision-1',
    type: 'routerNode',
    position: { x: 500, y: 190 },
    data: {
      kind: 'router',
      label: 'Route Intent',
      routerFn: 'def route(state):\n    return "next"',
      branches: [
        { id: 'b1', label: 'use_tool', condition: 'default' },
        { id: 'b2', label: 'direct', condition: 'fallback' },
      ],
    },
  },
  {
    id: 'tool-1',
    type: 'toolNode',
    position: { x: 760, y: 120 },
    data: {
      kind: 'tool',
      label: 'Web Search',
      connectionType: 'inline',
      toolRegistryId: '',
      mcpServerId: '',
      mcpToolName: '',
      toolName: 'search',
      toolDescription: 'Search the web for answers',
      inputSchema: '{}',
      inputKey: 'query',
      outputKey: 'tool_result',
    },
  },
  {
    id: 'fn-1',
    type: 'functionNode',
    position: { x: 760, y: 300 },
    data: {
      kind: 'function',
      label: 'Format',
      functionName: 'format_reply',
      code: 'def format_reply(state):\n    return {"result": state.get("messages", [])}',
      outputKey: 'result',
    },
  },
  {
    id: 'end-1',
    type: 'endNode',
    position: { x: 1020, y: 220 },
    data: { kind: 'end', label: 'End' },
    deletable: false,
  },
]

const initialEdges: Edge[] = [
  styledEdge('e-start-llm', 'start-1', 'llm-1', 'start'),
  styledEdge('e-llm-decision', 'llm-1', 'decision-1', 'llm'),
  styledEdge('e-decision-tool', 'decision-1', 'tool-1', 'router', 'b1'),
  styledEdge('e-decision-fn', 'decision-1', 'fn-1', 'router', 'b2'),
  styledEdge('e-tool-end', 'tool-1', 'end-1', 'tool'),
  styledEdge('e-fn-end', 'fn-1', 'end-1', 'function'),
]

const initialCanvasByGraph: Record<string, CanvasSnapshot> = {
  [MAIN_GRAPH_ID]: { nodes: initialNodes, edges: initialEdges },
}

interface RedoSnapshot {
  document: GraphDocument
  canvasByGraph: Record<string, CanvasSnapshot>
  navigationPath: string[]
  nodes: Node<StitchNodeData>[]
  edges: Edge[]
}

let redoSnapshot: RedoSnapshot | null = null

function applyCanvasUpdate(
  get: () => GraphStore,
  set: (partial: Partial<GraphStore>) => void,
  nodes: Node<StitchNodeData>[],
  edges: Edge[],
) {
  const state = get()
  const id = state.document.activeSubgraphId
  set({
    nodes,
    edges,
    canvasByGraph: syncCanvas(state.canvasByGraph, id, nodes, edges),
  })
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  document: createDefaultDocument(),
  canvasByGraph: initialCanvasByGraph,
  navigationPath: [MAIN_GRAPH_ID],
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  showCodePanel: true,
  designerTab: 'graph',

  setNodes: (nodes) => applyCanvasUpdate(get, set, nodes, get().edges),
  setEdges: (edges) => applyCanvasUpdate(get, set, get().nodes, edges),

  onNodesChange: (changes) =>
    applyCanvasUpdate(get, set, applyNodeChanges(changes, get().nodes), get().edges),

  onEdgesChange: (changes) =>
    applyCanvasUpdate(get, set, get().nodes, applyEdgeChanges(changes, get().edges)),

  onConnect: (connection) => {
    const sourceNode = get().nodes.find((n) => n.id === connection.source)
    const kind = sourceNode?.data.kind ?? 'llm'
    const color = getNodeTheme(kind).edgeColor
    applyCanvasUpdate(
      get,
      set,
      get().nodes,
      addEdge(
        {
          ...connection,
          animated: true,
          style: { stroke: color, strokeWidth: 2.5 },
        },
        get().edges,
      ),
    )
  },

  addNode: (node) => applyCanvasUpdate(get, set, [...get().nodes, node], get().edges),

  updateNodeData: (nodeId, data) =>
    applyCanvasUpdate(
      get,
      set,
      get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } as StitchNodeData } : n,
      ),
      get().edges,
    ),

  removeNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId)
    if (node?.data.kind === 'start' || node?.data.kind === 'end') return
    applyCanvasUpdate(
      get,
      set,
      get().nodes.filter((n) => n.id !== nodeId),
      get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    )
    if (get().selectedNodeId === nodeId) set({ selectedNodeId: null })
  },

  selectNode: (nodeId) =>
    set({
      selectedNodeId: nodeId,
      designerTab: nodeId ? 'node' : get().designerTab,
    }),
  toggleCodePanel: () => set({ showCodePanel: !get().showCodePanel }),

  setDesignerTab: (tab) => set({ designerTab: tab }),

  setDocumentMeta: (meta) =>
    set({ document: { ...get().document, ...meta } }),

  updateGraphSettings: (settings) => {
    const current = get().document.settings ?? DEFAULT_GRAPH_SETTINGS
    set({
      document: {
        ...get().document,
        settings: {
          ...current,
          ...settings,
          lifecycle: { ...current.lifecycle, ...settings.lifecycle },
          checkpointer: { ...current.checkpointer, ...settings.checkpointer },
          observability: {
            ...current.observability,
            ...settings.observability,
            langsmith: { ...current.observability.langsmith, ...settings.observability?.langsmith },
            langfuse: { ...current.observability.langfuse, ...settings.observability?.langfuse },
            logging: { ...current.observability.logging, ...settings.observability?.logging },
          },
          eval: { ...current.eval, ...settings.eval },
          a2a: { ...current.a2a, ...settings.a2a },
        },
      },
    })
  },

  addStateField: (field) =>
    set({
      document: {
        ...get().document,
        stateFields: [...get().document.stateFields, field],
      },
    }),

  updateStateField: (id, field) =>
    set({
      document: {
        ...get().document,
        stateFields: get().document.stateFields.map((f) =>
          f.id === id ? { ...f, ...field } : f,
        ),
      },
    }),

  removeStateField: (id) =>
    set({
      document: {
        ...get().document,
        stateFields: get().document.stateFields.filter((f) => f.id !== id),
      },
    }),

  addSubgraph: (name) => {
    const parentId = get().document.activeSubgraphId
    const sg = createSubgraph(name, parentId)
    const empty = createEmptySubgraphCanvas()
    const canvasByGraph = persistActiveCanvas(get())
    set({
      canvasByGraph: { ...canvasByGraph, [sg.id]: empty },
      document: {
        ...get().document,
        subgraphs: [...get().document.subgraphs, sg],
      },
    })
    get().enterSubgraph(sg.id)
    return sg.id
  },

  navigateToGraph: (graphId) => {
    const state = get()
    const canvasByGraph = persistActiveCanvas(state)
    const canvas = canvasByGraph[graphId] ?? createEmptySubgraphCanvas()
    const path = buildPathToGraph(graphId, state.document.subgraphs)
    set({
      canvasByGraph,
      navigationPath: path,
      document: { ...state.document, activeSubgraphId: graphId },
      nodes: canvas.nodes,
      edges: canvas.edges,
      selectedNodeId: null,
    })
  },

  enterSubgraph: (graphId) => {
    const state = get()
    if (graphId === state.document.activeSubgraphId) return
    const canvasByGraph = persistActiveCanvas(state)
    const canvas = canvasByGraph[graphId] ?? createEmptySubgraphCanvas()
    if (!canvasByGraph[graphId]) {
      canvasByGraph[graphId] = canvas
    }
    const path = [...state.navigationPath]
    if (path[path.length - 1] !== graphId) path.push(graphId)
    set({
      canvasByGraph,
      navigationPath: path,
      document: { ...state.document, activeSubgraphId: graphId },
      nodes: canvas.nodes,
      edges: canvas.edges,
      selectedNodeId: null,
      designerTab: 'graph',
    })
  },

  zoomOutSubgraph: () => {
    const state = get()
    if (state.navigationPath.length <= 1) return
    const canvasByGraph = persistActiveCanvas(state)
    const parentPath = state.navigationPath.slice(0, -1)
    const parentId = parentPath[parentPath.length - 1]
    const canvas = canvasByGraph[parentId] ?? createEmptySubgraphCanvas()
    set({
      canvasByGraph,
      navigationPath: parentPath,
      document: { ...state.document, activeSubgraphId: parentId },
      nodes: canvas.nodes,
      edges: canvas.edges,
      selectedNodeId: null,
    })
  },

  addRemoteGraph: (ref) =>
    set({
      document: {
        ...get().document,
        remoteGraphs: [...(get().document.remoteGraphs ?? []), ref],
      },
    }),

  updateRemoteGraph: (id, ref) =>
    set({
      document: {
        ...get().document,
        remoteGraphs: (get().document.remoteGraphs ?? []).map((r) =>
          r.id === id ? { ...r, ...ref } : r,
        ),
      },
    }),

  removeRemoteGraph: (id) =>
    set({
      document: {
        ...get().document,
        remoteGraphs: (get().document.remoteGraphs ?? []).filter((r) => r.id !== id),
      },
    }),

  addToolDefinition: (tool) =>
    set({
      document: {
        ...get().document,
        toolRegistry: [...(get().document.toolRegistry ?? []), tool],
      },
    }),

  updateToolDefinition: (id, tool) =>
    set({
      document: {
        ...get().document,
        toolRegistry: (get().document.toolRegistry ?? []).map((t) =>
          t.id === id ? { ...t, ...tool } : t,
        ),
      },
    }),

  removeToolDefinition: (id) =>
    set({
      document: {
        ...get().document,
        toolRegistry: (get().document.toolRegistry ?? []).filter((t) => t.id !== id),
      },
    }),

  addAgentDefinition: (agent) =>
    set({
      document: {
        ...get().document,
        agentRegistry: [...(get().document.agentRegistry ?? []), agent],
      },
    }),

  updateAgentDefinition: (id, agent) =>
    set({
      document: {
        ...get().document,
        agentRegistry: (get().document.agentRegistry ?? []).map((a) =>
          a.id === id ? { ...a, ...agent } : a,
        ),
      },
    }),

  removeAgentDefinition: (id) =>
    set({
      document: {
        ...get().document,
        agentRegistry: (get().document.agentRegistry ?? []).filter((a) => a.id !== id),
      },
    }),

  addMcpServer: (server) =>
    set({
      document: {
        ...get().document,
        mcpServers: [...(get().document.mcpServers ?? []), server],
      },
    }),

  updateMcpServer: (id, server) =>
    set({
      document: {
        ...get().document,
        mcpServers: (get().document.mcpServers ?? []).map((s) =>
          s.id === id ? { ...s, ...server } : s,
        ),
      },
    }),

  removeMcpServer: (id) =>
    set({
      document: {
        ...get().document,
        mcpServers: (get().document.mcpServers ?? []).filter((s) => s.id !== id),
      },
    }),

  addSkillDefinition: (skill) =>
    set({ document: { ...get().document, skillRegistry: [...(get().document.skillRegistry ?? []), skill] } }),
  updateSkillDefinition: (id, skill) =>
    set({
      document: {
        ...get().document,
        skillRegistry: (get().document.skillRegistry ?? []).map((s) => (s.id === id ? { ...s, ...skill } : s)),
      },
    }),
  removeSkillDefinition: (id) =>
    set({
      document: {
        ...get().document,
        skillRegistry: (get().document.skillRegistry ?? []).filter((s) => s.id !== id),
      },
    }),

  addGuardrailDefinition: (guardrail) =>
    set({ document: { ...get().document, guardrailRegistry: [...(get().document.guardrailRegistry ?? []), guardrail] } }),
  updateGuardrailDefinition: (id, guardrail) =>
    set({
      document: {
        ...get().document,
        guardrailRegistry: (get().document.guardrailRegistry ?? []).map((g) =>
          g.id === id ? { ...g, ...guardrail } : g,
        ),
      },
    }),
  removeGuardrailDefinition: (id) =>
    set({
      document: {
        ...get().document,
        guardrailRegistry: (get().document.guardrailRegistry ?? []).filter((g) => g.id !== id),
      },
    }),

  addBusinessRuleDefinition: (rule) =>
    set({ document: { ...get().document, businessRuleRegistry: [...(get().document.businessRuleRegistry ?? []), rule] } }),
  updateBusinessRuleDefinition: (id, rule) =>
    set({
      document: {
        ...get().document,
        businessRuleRegistry: (get().document.businessRuleRegistry ?? []).map((r) =>
          r.id === id ? { ...r, ...rule } : r,
        ),
      },
    }),
  removeBusinessRuleDefinition: (id) =>
    set({
      document: {
        ...get().document,
        businessRuleRegistry: (get().document.businessRuleRegistry ?? []).filter((r) => r.id !== id),
      },
    }),

  addPersonaDefinition: (persona) =>
    set({ document: { ...get().document, personaRegistry: [...(get().document.personaRegistry ?? []), persona] } }),
  updatePersonaDefinition: (id, persona) =>
    set({
      document: {
        ...get().document,
        personaRegistry: (get().document.personaRegistry ?? []).map((p) =>
          p.id === id ? { ...p, ...persona } : p,
        ),
      },
    }),
  removePersonaDefinition: (id) =>
    set({
      document: {
        ...get().document,
        personaRegistry: (get().document.personaRegistry ?? []).filter((p) => p.id !== id),
      },
    }),

  addRagPipeline: (pipeline) =>
    set({ document: { ...get().document, ragPipelines: [...(get().document.ragPipelines ?? []), pipeline] } }),
  updateRagPipeline: (id, pipeline) =>
    set({
      document: {
        ...get().document,
        ragPipelines: (get().document.ragPipelines ?? []).map((p) =>
          p.id === id ? { ...p, ...pipeline } : p,
        ),
      },
    }),
  removeRagPipeline: (id) =>
    set({
      document: {
        ...get().document,
        ragPipelines: (get().document.ragPipelines ?? []).filter((p) => p.id !== id),
      },
    }),

  getProjectPayload: () => {
    const state = get()
    const canvasByGraph = persistActiveCanvas(state)
    return {
      document: state.document,
      canvasByGraph,
      navigationPath: state.navigationPath,
      nodes: state.nodes,
      edges: state.edges,
    }
  },

  loadProject: (payload) => {
    type LoadPayload = Parameters<GraphStore['loadProject']>[0] & Record<string, unknown>
    const raw = payload as LoadPayload

    let document = raw.document
    let nodes = raw.nodes
    let edges = raw.edges
    let canvasByGraph = raw.canvasByGraph
    let navigationPath = raw.navigationPath

    if (!document) {
      const {
        nodes: n,
        edges: e,
        canvasByGraph: c,
        navigationPath: p,
        ...docFields
      } = raw
      document = docFields as unknown as GraphDocument
      nodes = nodes ?? (n as typeof nodes)
      edges = edges ?? (e as typeof edges)
      canvasByGraph = canvasByGraph ?? (c as typeof canvasByGraph)
      navigationPath = navigationPath ?? (p as typeof navigationPath)
    }

    const doc: GraphDocument = {
      ...createDefaultDocument(),
      ...document,
      settings: mergeGraphSettings(document.settings),
      remoteGraphs: document.remoteGraphs ?? [],
      toolRegistry: document.toolRegistry ?? [],
      agentRegistry: document.agentRegistry ?? [],
      mcpServers: document.mcpServers ?? [],
      skillRegistry: document.skillRegistry ?? [],
      guardrailRegistry: document.guardrailRegistry ?? [],
      businessRuleRegistry: document.businessRuleRegistry ?? [],
      personaRegistry: document.personaRegistry ?? [],
      ragPipelines: document.ragPipelines ?? [],
      subgraphs: (document.subgraphs ?? []).map((sg) => ({
        ...sg,
        parentId: sg.parentId ?? (sg.id === MAIN_GRAPH_ID ? null : MAIN_GRAPH_ID),
      })),
    }

    if (!canvasByGraph && nodes && edges) {
      canvasByGraph = { [MAIN_GRAPH_ID]: { nodes, edges } }
    }
    canvasByGraph = canvasByGraph ?? { [MAIN_GRAPH_ID]: createEmptySubgraphCanvas() }

    const activeId = doc.activeSubgraphId || MAIN_GRAPH_ID
    const active = canvasByGraph[activeId] ?? canvasByGraph[MAIN_GRAPH_ID]

    set({
      document: doc,
      canvasByGraph,
      navigationPath: navigationPath ?? buildPathToGraph(activeId, doc.subgraphs),
      nodes: active.nodes,
      edges: active.edges,
      selectedNodeId: null,
      designerTab: 'graph',
    })
  },

  resetProject: () => {
    const state = get()
    redoSnapshot = {
      document: state.document,
      canvasByGraph: persistActiveCanvas(state),
      navigationPath: state.navigationPath,
      nodes: state.nodes,
      edges: state.edges,
    }
    set({
      document: createDefaultDocument(),
      canvasByGraph: initialCanvasByGraph,
      navigationPath: [MAIN_GRAPH_ID],
      nodes: initialNodes,
      edges: initialEdges,
      selectedNodeId: null,
      designerTab: 'graph',
    })
  },

  redoProject: () => {
    if (!redoSnapshot) return
    const snap = redoSnapshot
    redoSnapshot = null
    set({
      document: snap.document,
      canvasByGraph: snap.canvasByGraph,
      navigationPath: snap.navigationPath,
      nodes: snap.nodes,
      edges: snap.edges,
      selectedNodeId: null,
      designerTab: 'graph',
    })
  },

  canRedo: () => redoSnapshot !== null,

  updateViewport: (viewport) => {
    const state = get()
    const id = state.document.activeSubgraphId
    const canvasByGraph = persistActiveCanvas(state)
    const current = canvasByGraph[id] ?? { nodes: state.nodes, edges: state.edges }
    canvasByGraph[id] = { ...current, viewport }
    saveViewport(state.document.name, viewport)
    set({ canvasByGraph })
  },
}))

export { MAIN_GRAPH_ID }
