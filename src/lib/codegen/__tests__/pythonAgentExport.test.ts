import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { createDefaultDocument, exportGraphDocument, generatePythonCode } from '../pythonGenerator'
import { generatePythonProject } from '../pythonProjectGenerator'
import type { AgentNodeData, GraphDocument, StitchNodeData } from '../../../types/graph'

function makeAgentNode(id: string, data: Partial<AgentNodeData>): Node<StitchNodeData> {
  return {
    id,
    type: 'agentNode',
    position: { x: 0, y: 0 },
    data: {
      kind: 'agent',
      label: 'Agent',
      description: 'Delegates to a registered agent',
      connectionType: 'registry',
      agentRegistryId: '',
      subgraphId: '',
      remoteAgentId: '',
      a2aAgentId: '',
      inputMapping: '',
      outputMapping: '',
      delegateTools: false,
      ...data,
    },
  }
}

function docWithAgents(): GraphDocument {
  const doc = createDefaultDocument()
  doc.agentRegistry = [
    {
      id: 'remote_billing',
      name: 'Remote Billing',
      description: 'Remote billing graph',
      kind: 'remote',
      subgraphId: '',
      remoteUrl: 'https://billing.example.com/invoke',
      a2aAgentCardUrl: '',
      model: 'gpt-4o-mini',
      systemPrompt: '',
      toolIds: [],
      authEnvVar: 'BILLING_TOKEN',
    },
    {
      id: 'a2a_research',
      name: 'A2A Research',
      description: 'A2A research agent',
      kind: 'a2a',
      subgraphId: '',
      remoteUrl: '',
      a2aAgentCardUrl: 'https://research.example.com/.well-known/agent.json',
      model: 'gpt-4o-mini',
      systemPrompt: '',
      toolIds: [],
      authEnvVar: 'A2A_TOKEN',
    },
  ]
  doc.remoteGraphs = [
    {
      id: 'remote_graph',
      name: 'Remote Graph',
      url: 'https://graph.example.com/invoke',
      authEnvVar: 'GRAPH_TOKEN',
      version: '1.0.0',
    },
  ]
  doc.settings = {
    ...doc.settings!,
    a2a: {
      ...doc.settings!.a2a,
      enabled: true,
      agentCardUrl: 'https://default.example.com/.well-known/agent.json',
      skillId: 'default',
      authEnvVar: 'A2A_DEFAULT_TOKEN',
    },
  }
  return doc
}

describe('Python agent export', () => {
  it('registers remote and A2A agents with SDK primitives', () => {
    const py = generatePythonCode(docWithAgents(), [], [])

    expect(py).toContain('remote_agent(')
    expect(py).toContain('"remote_billing"')
    expect(py).toContain('register_agent(')
    expect(py).toContain('transport="a2a"')
    expect(py).toContain('https://research.example.com/.well-known/agent.json')
  })

  it('delegates generated remote and A2A agent nodes through run_agent', () => {
    const nodes = [
      makeAgentNode('remote-node', { connectionType: 'remote', remoteAgentId: 'remote_billing' }),
      makeAgentNode('a2a-node', { connectionType: 'a2a', a2aAgentId: 'a2a_research' }),
    ]
    const py = generatePythonCode(docWithAgents(), nodes, [] as Edge[])

    expect(py).toContain('result = run_agent(_agent_input(state), "remote_billing")')
    expect(py).toContain('result = run_agent(_agent_input(state), "a2a_research"')
    expect(py).not.toContain('A2A response stub')
    expect(py).not.toContain('TODO: implement A2A message/send')
  })

  it('exports populated remote and A2A connection modules', () => {
    const doc = docWithAgents()
    const files = generatePythonProject(doc, exportGraphDocument(doc, [], []), [], [])
    const pkg = 'my_langgraph'

    expect(files[`src/${pkg}/connections/remote.py`]).toContain('REMOTE_GRAPHS')
    expect(files[`src/${pkg}/connections/remote.py`]).toContain('https://graph.example.com/invoke')
    expect(files[`src/${pkg}/connections/remote.py`]).toContain('REMOTE_AGENTS')
    expect(files[`src/${pkg}/connections/remote.py`]).toContain('https://billing.example.com/invoke')
    expect(files[`src/${pkg}/connections/a2a.py`]).toContain('A2A_AGENTS')
    expect(files[`src/${pkg}/connections/a2a.py`]).toContain('https://research.example.com/.well-known/agent.json')
    expect(files[`src/${pkg}/connections/a2a.py`]).toContain('A2A_CONFIG')
  })
})
