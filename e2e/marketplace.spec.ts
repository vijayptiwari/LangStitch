import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const fixtureDir = path.dirname(fileURLToPath(import.meta.url))
const sampleVsix = path.join(fixtureDir, 'fixtures', 'sample.vsix')

async function e2eLogin(
  request: APIRequestContext,
  email: string,
  name: string,
): Promise<{ token: string; is_admin: boolean }> {
  const res = await request.post('/api/auth/e2e/login', {
    data: { email, name },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = (await res.json()) as { token: string; is_admin: boolean }
  return body
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function reviewPath(fullUrl: string): string {
  const url = new URL(fullUrl)
  return `${url.pathname}${url.search}`
}

test.describe('Marketplace publish & review', () => {
  test('catalog browse is public', async ({ request }) => {
    const res = await request.get('/api/marketplace/plugins')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { plugins: { slug: string }[] }
    expect(body.plugins.length).toBeGreaterThan(0)
    expect(body.plugins.some((p) => p.slug === 'langtailor-canvas')).toBeTruthy()
  })

  test('publish requires authentication', async ({ request }) => {
    const res = await request.post('/api/marketplace/publish', {
      data: {
        name: 'Unauthorized',
        extension_id: 'e2e.unauth',
        download_url: 'https://example.com/x.vsix',
      },
    })
    expect(res.status()).toBe(401)
  })

  test('upload → pending → admin approve → public catalog', async ({ request }) => {
    const extId = `e2e.flow-${Date.now()}`
    const pub = await e2eLogin(request, 'publisher@e2e.test', 'E2E Publisher')

    const upload = await request.post('/api/marketplace/publish/upload', {
      headers: authHeaders(pub.token),
      multipart: {
        name: 'E2E Flow Connector',
        extension_id: extId,
        version: '1.0.0',
        kind: 'connector',
        purpose: 'Automated E2E verification',
        input_schema: '{"query":"string"}',
        output_schema: '{"ok":"boolean"}',
        artifact: {
          name: 'sample.vsix',
          mimeType: 'application/zip',
          buffer: fs.readFileSync(sampleVsix),
        },
      },
    })
    expect(upload.ok(), await upload.text()).toBeTruthy()
    const submission = (await upload.json()) as {
      status: string
      submission: { slug: string; download_url: string }
    }
    expect(submission.status).toBe('pending')
    const slug = submission.submission.slug

    const browseBefore = await request.get('/api/marketplace/plugins')
    const beforeSlugs = ((await browseBefore.json()) as { plugins: { slug: string }[] }).plugins.map(
      (p) => p.slug,
    )
    expect(beforeSlugs).not.toContain(slug)

    const mySubs = await request.get('/api/marketplace/my/submissions', {
      headers: authHeaders(pub.token),
    })
    expect(mySubs.ok()).toBeTruthy()
    const subs = (await mySubs.json()) as { submissions: { slug: string; status: string }[] }
    expect(subs.submissions.some((s) => s.slug === slug && s.status === 'pending')).toBeTruthy()

    const admin = await e2eLogin(request, 'dev@langstitch.com', 'Reviewer')
    expect(admin.is_admin).toBeTruthy()

    const pending = await request.get('/api/marketplace/submissions', {
      headers: authHeaders(admin.token),
    })
    expect(pending.ok()).toBeTruthy()
    const pendingSlugs = ((await pending.json()) as { submissions: { slug: string }[] }).submissions.map(
      (s) => s.slug,
    )
    expect(pendingSlugs).toContain(slug)

    const approved = await request.post(`/api/marketplace/submissions/${slug}/approve`, {
      headers: authHeaders(admin.token),
      data: { notes: 'E2E approved' },
    })
    expect(approved.ok(), await approved.text()).toBeTruthy()

    const browseAfter = await request.get('/api/marketplace/plugins')
    const afterSlugs = ((await browseAfter.json()) as { plugins: { slug: string }[] }).plugins.map(
      (p) => p.slug,
    )
    expect(afterSlugs).toContain(slug)

    const artifactPath = new URL(submission.submission.download_url).pathname
    const dl = await request.get(artifactPath)
    expect(dl.ok()).toBeTruthy()
    expect((await dl.body()).length).toBeGreaterThan(0)
  })

  test('email review link can approve a pending submission', async ({ request }) => {
    const extId = `e2e.link-approve-${Date.now()}`
    const pub = await e2eLogin(request, 'link-pub@e2e.test', 'Link Publisher')

    const upload = await request.post('/api/marketplace/publish/upload', {
      headers: authHeaders(pub.token),
      multipart: {
        name: 'Email Link Approve Connector',
        extension_id: extId,
        version: '1.0.0',
        artifact: {
          name: 'sample.vsix',
          mimeType: 'application/zip',
          buffer: fs.readFileSync(sampleVsix),
        },
      },
    })
    expect(upload.ok(), await upload.text()).toBeTruthy()
    const slug = ((await upload.json()) as { submission: { slug: string } }).submission.slug

    const admin = await e2eLogin(request, 'dev@langstitch.com', 'Reviewer')
    const tokenRes = await request.post('/api/marketplace/e2e/review-token', {
      headers: authHeaders(admin.token),
      data: { slug },
    })
    expect(tokenRes.ok(), await tokenRes.text()).toBeTruthy()
    const { approve_url } = (await tokenRes.json()) as { approve_url: string }

    const review = await request.get(reviewPath(approve_url))
    const reviewHtml = await review.text()
    expect(review.ok(), reviewHtml).toBeTruthy()
    expect(reviewHtml).toContain('has been approved and published')

    const browse = await request.get('/api/marketplace/plugins')
    const slugs = ((await browse.json()) as { plugins: { slug: string }[] }).plugins.map((p) => p.slug)
    expect(slugs).toContain(slug)
  })

  test('email review link can reject a pending submission', async ({ request }) => {
    const extId = `e2e.link-reject-${Date.now()}`
    const pub = await e2eLogin(request, 'link-reject-pub@e2e.test', 'Link Reject Pub')

    const upload = await request.post('/api/marketplace/publish/upload', {
      headers: authHeaders(pub.token),
      multipart: {
        name: 'Email Link Reject Connector',
        extension_id: extId,
        version: '0.2.0',
        artifact: {
          name: 'sample.vsix',
          mimeType: 'application/zip',
          buffer: fs.readFileSync(sampleVsix),
        },
      },
    })
    const slug = ((await upload.json()) as { submission: { slug: string } }).submission.slug

    const admin = await e2eLogin(request, 'dev@langstitch.com', 'Reviewer')
    const tokenRes = await request.post('/api/marketplace/e2e/review-token', {
      headers: authHeaders(admin.token),
      data: { slug },
    })
    const { reject_url } = (await tokenRes.json()) as { reject_url: string }

    const review = await request.get(reviewPath(reject_url))
    const reviewHtml = await review.text()
    expect(review.ok()).toBeTruthy()
    expect(reviewHtml).toContain('has been rejected')

    const browse = await request.get('/api/marketplace/plugins')
    const slugs = ((await browse.json()) as { plugins: { slug: string }[] }).plugins.map((p) => p.slug)
    expect(slugs).not.toContain(slug)
  })

  test('admin can reject a pending submission', async ({ request }) => {
    const extId = `e2e.email-${Date.now()}`
    const pub = await e2eLogin(request, 'email-pub@e2e.test', 'Email Pub')

    const upload = await request.post('/api/marketplace/publish/upload', {
      headers: authHeaders(pub.token),
      multipart: {
        name: 'Email Link Connector',
        extension_id: extId,
        version: '0.1.0',
        artifact: {
          name: 'sample.vsix',
          mimeType: 'application/zip',
          buffer: fs.readFileSync(sampleVsix),
        },
      },
    })
    const slug = ((await upload.json()) as { submission: { slug: string } }).submission.slug

    // Mint review token via admin API list + internal approve isn't needed;
    // fetch review token from approve email isn't available in E2E — use submissions API reject path instead
    const admin = await e2eLogin(request, 'dev@langstitch.com', 'Reviewer')
    const reject = await request.post(`/api/marketplace/submissions/${slug}/reject`, {
      headers: authHeaders(admin.token),
      data: { notes: 'E2E reject path' },
    })
    expect(reject.ok()).toBeTruthy()
    const rejected = (await reject.json()) as { submission: { status: string } }
    expect(rejected.submission.status).toBe('rejected')

    const browse = await request.get('/api/marketplace/plugins')
    const slugs = ((await browse.json()) as { plugins: { slug: string }[] }).plugins.map((p) => p.slug)
    expect(slugs).not.toContain(slug)
  })

  test('UI: publish form uploads a vsix and shows in submissions', async ({ page }) => {
    const login = await page.request.post('/api/auth/e2e/login', {
      data: { email: 'ui-publisher@e2e.test', name: 'UI Publisher' },
    })
    expect(login.ok()).toBeTruthy()

    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('toolbar-marketplace').click()
    await expect(page.getByTestId('marketplace')).toBeVisible()
    await page.getByTestId('mk-tab-publish').click()

    const extId = `e2e.ui.${Date.now()}`
    const name = `UI E2E Connector ${Date.now()}`
    await page.locator('.mk-publish input').nth(0).fill(name)
    await page.locator('.mk-field:has-text("Extension ID") input').fill(extId)
    await page.getByTestId('mk-vsix-file').setInputFiles(sampleVsix)
    await page.locator('.mk-field:has-text("Purpose") textarea').fill('UI automation test')
    await page.getByTestId('mk-publish-form').locator('button[type="submit"]').click()

    // PublishForm calls onSubmitted → switches to the Submissions tab on success.
    await expect(page.getByTestId('mk-tab-submissions')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.mk-sub-card').filter({ hasText: extId })).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.locator('.mk-sub-card').filter({ hasText: extId }).locator('.mk-status-pending'),
    ).toBeVisible()
  })
})
