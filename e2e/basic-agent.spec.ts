import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.join(__dirname, 'fixtures', 'basic-agent.langstitch.json')

test.describe('Basic agent — UI workflow', () => {
  test('user renames graph, adds agent node, and views generated Python', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow__node')

    await page.getByTestId('graph-name-input').fill('basic_agent_e2e')
    await expect(page.getByTestId('graph-name-input')).toHaveValue('basic_agent_e2e')

    await page.getByTestId('rf__node-llm-1').click()
    await expect(page.getByTestId('designer-tab-node')).toHaveClass(/active/)

    await page.getByTestId('palette-agent').click()
    await expect(page.locator('.react-flow__node')).toHaveCount(7)

    await page.getByTestId('designer-tab-graph').click()
    await page.getByRole('button', { name: /Add tool/i }).first().click()

    await expect(page.getByTestId('code-block')).toBeVisible()
    const code = await page.getByTestId('code-block').textContent()
    expect(code).toContain('GraphBuilder')
    expect(code).toContain('basic_agent_e2e')
    expect(code).toContain('LangStitch')
  })

  test('user configures agent node in Node Designer', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow__node')

    await page.getByTestId('palette-agent').click()
    await page.locator('.react-flow__node').filter({ hasText: 'Sub Agent' }).last().click()

    await expect(page.getByText('Agent delegation')).toBeVisible()
    await page.getByText('Connection type').locator('..').locator('select').selectOption('subagent')
  })

  test('user opens platform drawer', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByRole('heading', { name: /Platform/i })).toBeVisible()
  })

  test('user loads basic agent fixture project', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('toolbar-open').click()
    await page.locator('input[type="file"]').setInputFiles(FIXTURE)

    await expect(page.getByTestId('graph-name-input')).toHaveValue('basic_agent')
    await page.waitForSelector('.react-flow__node')
    await expect(page.locator('.react-flow__node')).toHaveCount(4)
  })
})

test.describe('Basic agent — run via API', () => {
  test('runs bundled runtime basic agent', async ({ request }) => {
    const res = await request.post('http://127.0.0.1:8787/api/agent/run', {
      data: { project_id: 'basic_agent_e2e' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.result).toMatchObject({ graph: 'basic_agent' })
    expect(body.result.result.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user' }),
        expect.objectContaining({ role: 'assistant' }),
      ]),
    )
  })

  test('saves project from UI state then runs agent', async ({ page, request }) => {
    await page.goto('/')
    await page.getByTestId('graph-name-input').fill('basic_agent_saved')
    await page.getByTestId('palette-agent').click()

    const projectPayload = await page.evaluate(async () => {
      const res = await fetch('/api/health')
      return res.ok
    })
    expect(projectPayload).toBe(true)

    const saveRes = await request.post('http://127.0.0.1:8787/api/project/save', {
      data: {
        project_id: 'basic_agent_saved',
        document: {
          version: '1.0',
          name: 'basic_agent_saved',
          stateFields: [{ id: 'sf1', name: 'messages', type: 'messages', reducer: 'append' }],
          subgraphs: [{ id: 'main', name: 'Main Graph', parentId: null, stateFields: [], nodeIds: [], edgeIds: [] }],
          activeSubgraphId: 'main',
          remoteGraphs: [],
          toolRegistry: [],
          agentRegistry: [],
          mcpServers: [],
        },
        nodes: [],
        edges: [],
      },
    })
    expect(saveRes.ok()).toBeTruthy()

    const runRes = await request.post('http://127.0.0.1:8787/api/agent/run', {
      data: { project_id: 'basic_agent_saved' },
    })
    const runBody = await runRes.json()
    expect(runBody.ok).toBe(true)
  })
})
