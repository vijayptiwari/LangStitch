import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COMPONENT_FIXTURE = path.join(__dirname, 'fixtures', 'weather-fetcher.component.json')

// Template authored from scratch in AUTO-FR-1; carries a unique sentinel we can
// assert in both the live preview and the generated Python code panel.
const GREETER_TEMPLATE = [
  'def {{nodeName}}(state: State) -> dict:',
  '    """GREETER_SENTINEL {{label}}"""',
  '    name = {{field.field_1}}',
  '    return {"{{outputKey}}": name}',
  '',
].join('\n')

async function openComponentsTab(page: import('@playwright/test').Page) {
  await page.getByTestId('designer-tab-components').click()
  await expect(page.getByTestId('component-designer')).toBeVisible()
}

test.describe('SDK Component Designer (cycle-141)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.waitForSelector('.react-flow__node')
  })

  // ---------------------------------------------------------------------------
  // AUTO-FR-1: author -> place -> configure -> export (FR-1..FR-5)
  // ---------------------------------------------------------------------------
  test('AUTO-FR-1-happy: author a component, place it, configure config, verify generated def @p0', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    // Step 1: open the Components designer tab -> empty state visible (FR-1)
    await openComponentsTab(page)
    await expect(page.getByTestId('component-empty-hint')).toBeVisible()

    // Step 2: create a new component manifest (pure data op, no files) (FR-1)
    await page.getByTestId('component-add').click()
    await expect(page.getByTestId('component-empty-hint')).toHaveCount(0)
    await expect(page.getByTestId('component-id-custom_component')).toHaveValue('custom_component')

    // Step 3: edit identity (FR-2)
    await page.getByTestId('component-label-custom_component').fill('Greeter')

    // Step 4: add a config field -> auto id "field_1" (FR-2)
    await page.getByTestId('component-add-field').click()

    // Step 5: author a safe codegen template with a sentinel (FR-2/NFR-4)
    await page.getByTestId('component-template-custom_component').fill(GREETER_TEMPLATE)

    // Step 6: live preview renders generated Python against default config (FR-5)
    const preview = page.getByTestId('component-preview-python')
    await expect(preview).toContainText('def custom_component(state: State) -> dict:')
    await expect(preview).toContainText('GREETER_SENTINEL Greeter')

    // Step 7: a valid manifest shows no hard validation error
    await expect(page.getByTestId('component-validation-error')).toHaveCount(0)

    // Step 8: the component appears in the palette under "Custom Components" (FR-3)
    await expect(page.getByTestId('palette-custom-group')).toBeVisible()
    await expect(page.getByTestId('palette-custom-custom_component')).toBeVisible()

    // Step 9: place it on the canvas (FR-3)
    await page.getByTestId('palette-custom-custom_component').click()
    await expect(page.getByTestId('custom-node-custom_component')).toBeVisible()
    await expect(page.locator('.react-flow__node')).toHaveCount(7)

    // Step 10: select the placed node -> Node designer shows the auto property form (FR-4)
    await page.getByTestId('custom-node-custom_component').click()
    await expect(page.getByTestId('designer-tab-node')).toHaveClass(/active/)

    // Step 11: edit config + output key (FR-4)
    await page.getByTestId('manifest-config-field-field_1').fill('Ada')
    await page.getByTestId('manifest-config-output-key').fill('greeting')

    // Step 12: generated Python code panel emits the templated def with escaped config (FR-5)
    const code = page.getByTestId('code-block')
    await expect(code).toContainText('GREETER_SENTINEL Greeter')
    await expect(code).toContainText('name = "Ada"')
    await expect(code).toContainText('"greeting"')
    const codeText = await code.textContent()
    expect(codeText).toMatch(/def custom_[a-z0-9_]+\(state: State\) -> dict:/)

    expect(consoleErrors).toEqual([])
  })

  // ---------------------------------------------------------------------------
  // AUTO-FR-1-validation: invalid template surfaces a blocking validation error
  // ---------------------------------------------------------------------------
  test('AUTO-FR-1-validation: template without def {{nodeName}} shows validation error @p0', async ({
    page,
  }) => {
    await openComponentsTab(page)
    await page.getByTestId('component-add').click()

    await page.getByTestId('component-template-custom_component').fill('return {}')

    const validation = page.getByTestId('component-validation-error')
    await expect(validation).toBeVisible()
    await expect(validation).toContainText(/def `?\{\{nodeName\}\}|nodeName/i)
  })

  // ---------------------------------------------------------------------------
  // AUTO-FR-4-missing: deleting a manifest with placed instances -> orphan node
  // renders as "missing component" and config form shows missing notice (errors).
  // ---------------------------------------------------------------------------
  test('AUTO-FR-4-missing: orphaned node after manifest delete renders missing shell @p0', async ({
    page,
  }) => {
    await openComponentsTab(page)
    await page.getByTestId('component-add').click()

    // place an instance
    await page.getByTestId('palette-custom-custom_component').click()
    await expect(page.getByTestId('custom-node-custom_component')).toBeVisible()

    // delete the manifest (confirm dialog reports the instance count)
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/placed instance/i)
      void dialog.accept()
    })
    await page.getByTestId('component-remove-custom_component').click()

    // palette entry gone; placed node now renders as missing
    await expect(page.getByTestId('palette-custom-custom_component')).toHaveCount(0)
    await expect(page.getByTestId('custom-node-missing')).toBeVisible()

    // selecting it shows the missing-manifest notice in the Node designer
    await page.getByTestId('custom-node-missing').click()
    await expect(page.getByTestId('manifest-config-missing')).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AUTO-FR-7-import: import a portable .component.json (no collision),
  // place it, configure a secret -> exported code uses os.environ.get (NFR-4).
  // ---------------------------------------------------------------------------
  test('AUTO-FR-7-import: import .component.json, place, secret emits os.environ.get @p0', async ({
    page,
  }) => {
    await openComponentsTab(page)

    // Step 1: import the portable component into the (fresh default) project (FR-7)
    await page.getByTestId('component-import-input').setInputFiles(COMPONENT_FIXTURE)
    await expect(page.getByTestId('component-id-weather_fetcher')).toHaveValue('weather_fetcher')
    await expect(page.getByTestId('palette-custom-weather_fetcher')).toBeVisible()

    // Step 2: place it (FR-3)
    await page.getByTestId('palette-custom-weather_fetcher').click()
    await expect(page.getByTestId('custom-node-weather_fetcher')).toBeVisible()

    // Step 3: configure including the secret field (FR-4)
    await page.getByTestId('custom-node-weather_fetcher').click()
    await page.getByTestId('manifest-config-field-city').fill('Paris')
    await page.getByTestId('manifest-config-field-api_key').fill('WEATHER_API_KEY')
    await page.getByTestId('manifest-config-output-key').fill('weather')

    // Step 4: generated code escapes string, never inlines secret, hoists import os (FR-5/NFR-4)
    const code = page.getByTestId('code-block')
    await expect(code).toContainText('WEATHER_SENTINEL Weather Fetcher')
    await expect(code).toContainText('city = "Paris"')
    await expect(code).toContainText('os.environ.get("WEATHER_API_KEY")')
    await expect(code).toContainText('"weather"')
    await expect(code).toContainText('import os')
  })

  // ---------------------------------------------------------------------------
  // AUTO-FR-7-collision: export .component.json then re-import same id ->
  // collision dialog -> "Import as copy" creates a second component (FR-7).
  // ---------------------------------------------------------------------------
  test('AUTO-FR-7-collision: export then re-import triggers collision "import as copy" @p0', async ({
    page,
  }) => {
    await openComponentsTab(page)
    await page.getByTestId('component-add').click()
    await expect(page.getByTestId('component-id-custom_component')).toHaveValue('custom_component')

    // Step 1: export -> download a real .component.json file
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('component-export-custom_component').click(),
    ])
    expect(download.suggestedFilename()).toBe('custom_component.component.json')
    const downloadPath = await download.path()
    expect(downloadPath).toBeTruthy()

    // Step 2: re-import the same file -> id collision dialog appears
    await page.getByTestId('component-import-input').setInputFiles(downloadPath!)
    await expect(page.getByTestId('component-collision-dialog')).toBeVisible()

    // Step 3: choose "Import as copy" -> dialog closes, a second component exists
    await page.getByTestId('component-collision-copy').click()
    await expect(page.getByTestId('component-collision-dialog')).toHaveCount(0)
    await expect(page.locator('[data-testid^="component-id-"]')).toHaveCount(2)
    // both appear as palette items (group header + 2 items share the prefix)
    await expect(page.locator('[data-testid^="palette-custom-"]')).toHaveCount(3)
  })

  // ---------------------------------------------------------------------------
  // AUTO-REG: regression — default project unaffected (NFR-1).
  // ---------------------------------------------------------------------------
  test('AUTO-REG-defaults: default project has no custom group and renders 6 nodes @regression', async ({
    page,
  }) => {
    await expect(page.locator('.react-flow__node')).toHaveCount(6)
    await expect(page.getByTestId('palette-custom-group')).toHaveCount(0)

    // built-in palette + canvas + designer still present
    await expect(page.getByTestId('node-palette')).toBeVisible()
    await expect(page.getByTestId('graph-canvas')).toBeVisible()
    await expect(page.getByTestId('designer-panel')).toBeVisible()

    // the new Components tab is mountable without disturbing defaults
    await openComponentsTab(page)
    await expect(page.getByTestId('component-empty-hint')).toBeVisible()
    await expect(page.locator('.react-flow__node')).toHaveCount(6)
  })
})
