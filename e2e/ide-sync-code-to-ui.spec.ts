import { test, expect } from '@playwright/test'

const NEW_NODE_MODULE = `# langstitch:node id=tool-sync-1 kind=tool label="Sync Tool"
"""Node: Sync Tool (tool)"""
from my_langgraph.state import State

def tool_sync_1(state: State) -> dict:
    """Sync test tool"""
# region CUSTOM
    return {"result": "synced"}
# endregion CUSTOM
`

test.describe('IDE sync code -> UI', () => {
  test('adding an annotated node module creates a canvas node', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('ide-shell')).toBeVisible()
    await page.getByTestId('toggle-code').click()
    await expect(page.getByTestId('code-editor-view')).toBeVisible()

    await page.waitForFunction(() => {
      const files = window.__langtailorIdeTest?.getVirtualFiles() ?? {}
      return Object.keys(files).some((p) => p.includes('/nodes/'))
    })

    await page.evaluate((moduleBody) => {
      const files = window.__langtailorIdeTest?.getVirtualFiles() ?? {}
      const pkg = Object.keys(files).find((p) => p.includes('pyproject.toml'))
      const pkgName = pkg?.match(/src\/([^/]+)\//)?.[1] ?? 'my_langgraph'
      const path = `src/${pkgName}/nodes/tool_sync_1.py`
      window.__langtailorIdeTest?.updateVirtualFile(path, moduleBody.replace('my_langgraph', pkgName))
    }, NEW_NODE_MODULE)

    await page.waitForFunction(() =>
      (window.__langtailorIdeTest?.getNodeIds() ?? []).includes('tool-sync-1'),
    )

    await page.getByTestId('toggle-canvas').click()
    await expect(page.locator('.react-flow__node[data-id="tool-sync-1"]')).toBeVisible()
  })
})
