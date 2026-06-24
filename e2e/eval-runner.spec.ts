import { test, expect } from '@playwright/test'

test.describe('LangSmith Eval Runner — FR coverage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('AUTO-FR-1-happy: user opens Eval tab in platform drawer @p0', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('eval-panel')).toBeVisible()
  })

  test('AUTO-FR-2-happy: user saves eval dataset name @p0', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-dataset-name').fill('pilot_regression_set')
    await expect(page.getByTestId('eval-dataset-name')).toHaveValue('pilot_regression_set')
  })

  test('AUTO-FR-6-negative: eval disabled hint when observability off @p0', async ({ page }) => {
    await page.getByTestId('designer-tab-graph').click()
    await page.getByRole('checkbox', { name: /Enable tracing & audit/i }).click()
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('eval-disabled-hint')).toBeVisible()
  })

  test('AUTO-FR-3-dry-run: validate eval config via API @p0', async ({ page, request }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-dataset-name').fill('pilot_dataset')
    await page.getByTestId('eval-experiment-prefix').fill('pilot_cycle_1')

    const res = await request.post('http://127.0.0.1:8787/api/eval/run', {
      data: {
        project_id: 'pilot_eval_test',
        eval_config: {
          enabled: true,
          dataset_name: 'pilot_dataset',
          dataset_id: '',
          experiment_prefix: 'pilot_cycle_1',
          max_concurrency: 2,
          description: 'e2e dry run',
        },
        langsmith_project: 'langstitch-graph',
        api_key_env: 'LANGCHAIN_API_KEY',
        dry_run: true,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.dry_run).toBe(true)
  })

  test('AUTO-FR-7-negative: eval API rejects missing dataset @p0', async ({ request }) => {
    const res = await request.post('http://127.0.0.1:8787/api/eval/run', {
      data: {
        project_id: 'pilot_eval_test',
        eval_config: {
          enabled: true,
          dataset_name: '',
          dataset_id: '',
          experiment_prefix: '',
          max_concurrency: 2,
          description: '',
        },
        langsmith_project: 'langstitch-graph',
        dry_run: true,
      },
    })
    expect(res.status()).toBe(400)
  })

  test('AUTO-FR-3-ui: validate config button shows result @p1', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-dataset-name').fill('pilot_dataset')
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Eval Runner — API health', () => {
  test('AUTO-API-1: eval endpoint registered @p0', async ({ request }) => {
    const res = await request.post('http://127.0.0.1:8787/api/eval/run', {
      data: {
        project_id: 'x',
        eval_config: {
          enabled: true,
          dataset_name: 'ds',
          dataset_id: '',
          experiment_prefix: 'p',
          max_concurrency: 1,
          description: '',
        },
        dry_run: true,
      },
    })
    expect(res.ok()).toBeTruthy()
  })
})
