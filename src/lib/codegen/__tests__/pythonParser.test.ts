import { describe, it, expect } from 'vitest'
import { parseGraphFromVirtualFiles } from '../pythonParser'

describe('pythonParser', () => {
  it('extracts custom region from virtual file', () => {
    const files = {
      'src/demo/nodes/llm_1.py': `# langstitch:node id=llm-1 kind=llm label="Assistant"
from demo.state import State

def llm_1(state: State) -> dict:
    # region CUSTOM
    return {"x": 1}
    # endregion CUSTOM
`,
    }
    const result = parseGraphFromVirtualFiles(files)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].customCode).toContain('return {"x": 1}')
  })

  it('returns diagnostics without throwing on empty files', () => {
    const result = parseGraphFromVirtualFiles({})
    expect(result.nodes).toHaveLength(0)
    expect(result.error).toBeUndefined()
  })
})
