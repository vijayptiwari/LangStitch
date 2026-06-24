/**
 * One-off export validation for cycle 51 — export-manifest.json + eval-dataset.
 * Run: node scripts/validate-cycle-51-export.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// Dynamic import compiled TS via vite? Use direct logic mirror via spawn tsc output.
// Import from dist is not available — invoke via playwright's ts path using node --experimental-vm-modules
// Instead duplicate minimal imports through tsx if available, else use built test pattern.

const { buildExportBundle, generateExportManifest } = await import(
  '../src/lib/codegen/bundleGenerator.ts'
)
const { createDefaultDocument, exportGraphDocument } = await import(
  '../src/lib/codegen/pythonGenerator.ts'
)
const { DEFAULT_EVAL } = await import('../src/lib/designerConstants.ts')

const results = []

function check(id, name, pass, evidence) {
  results.push({ id, name, pass, evidence })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${name}`)
  if (evidence) console.log(`  → ${evidence.slice(0, 200)}`)
}

const doc = createDefaultDocument()
doc.settings = {
  ...doc.settings,
  eval: { ...DEFAULT_EVAL, enabled: true, datasetName: 'cycle51_validation_ds', datasetId: 'ds-abc-123' },
}
const projectJson = exportGraphDocument(doc, [], [], {}, [doc.activeSubgraphId])

for (const format of ['python', 'full']) {
  const files = buildExportBundle(doc, projectJson, '', format)
  const keys = Object.keys(files).sort()

  check(
    `EXP-CHK-1-${format}`,
    `ZIP-equivalent bundle (${format}) contains pyproject.toml`,
    'pyproject.toml' in files,
    keys.filter((k) => k.includes('pyproject') || k.includes('langsmith')).join(', '),
  )
  check(
    `EXP-CHK-2-${format}`,
    `langsmith.json valid JSON (${format})`,
    (() => {
      try {
        JSON.parse(files['langsmith.json'])
        return true
      } catch {
        return false
      }
    })(),
    files['langsmith.json']?.slice(0, 120),
  )
  check(
    `EXP-CHK-3-${format}`,
    `export-manifest.json present (${format})`,
    Boolean(files['export-manifest.json']),
    keys.includes('export-manifest.json') ? 'found' : 'missing',
  )

  let manifest
  try {
    manifest = JSON.parse(files['export-manifest.json'])
  } catch (e) {
    manifest = null
  }
  check(
    `EXP-CHK-4-${format}`,
    `manifest valid JSON with version (${format})`,
    manifest?.version === '1.0' && Array.isArray(manifest?.files),
    manifest ? `version=${manifest.version}, files=${manifest.files.length}` : String(e),
  )
  check(
    `EXP-CHK-5-${format}`,
    `manifest lists export-manifest.json in files (${format})`,
    manifest?.files?.includes('export-manifest.json'),
    manifest?.files?.slice(-3).join(', '),
  )
  check(
    `EXP-CHK-6-${format}`,
    `eval-dataset block present when eval configured (${format})`,
    manifest?.['eval-dataset']?.enabled === true &&
      manifest?.['eval-dataset']?.dataset_name === 'cycle51_validation_ds' &&
      manifest?.['eval-dataset']?.dataset_id === 'ds-abc-123',
    JSON.stringify(manifest?.['eval-dataset']),
  )
  check(
    `EXP-CHK-7-${format}`,
    `eval-dataset bundle_files includes langsmith.json and eval_runner (${format})`,
    manifest?.['eval-dataset']?.bundle_files?.includes('langsmith.json') &&
      manifest?.['eval-dataset']?.bundle_files?.some((f) => f.includes('eval_runner.py')),
    manifest?.['eval-dataset']?.bundle_files?.join(', '),
  )

  const pkg = keys.find((k) => k.startsWith('src/') && k.endsWith('/graph.py'))
  check(
    `EXP-CHK-8-${format}`,
    `StateGraph module present (${format})`,
    Boolean(pkg),
    pkg ?? 'no graph.py',
  )
}

// Without eval — no eval-dataset block
const docNoEval = createDefaultDocument()
const pjNoEval = exportGraphDocument(docNoEval, [], [], {}, [docNoEval.activeSubgraphId])
const filesNoEval = buildExportBundle(docNoEval, pjNoEval, '', 'python')
const manifestNoEval = JSON.parse(filesNoEval['export-manifest.json'])
check(
  'EXP-CHK-9',
  'manifest omits eval-dataset when eval disabled',
  !('eval-dataset' in manifestNoEval),
  Object.keys(manifestNoEval).join(', '),
)
check(
  'EXP-CHK-10',
  'export-manifest.json still present without eval',
  Boolean(filesNoEval['export-manifest.json']),
  `files count: ${Object.keys(filesNoEval).length}`,
)

// Preview parity: generateExportManifest with same keys as buildExportBundle output
const previewManifest = generateExportManifest(doc, Object.keys(buildExportBundle(doc, projectJson, '', 'python')))
const bundleManifest = JSON.parse(buildExportBundle(doc, projectJson, '', 'python')['export-manifest.json'])
const previewParsed = JSON.parse(previewManifest)
check(
  'EXP-CHK-11',
  'preview manifest matches bundle eval-dataset fields',
  previewParsed['eval-dataset']?.dataset_name === bundleManifest['eval-dataset']?.dataset_name &&
    JSON.stringify(previewParsed['eval-dataset']?.bundle_files) ===
      JSON.stringify(bundleManifest['eval-dataset']?.bundle_files),
  `preview=${previewParsed['eval-dataset']?.dataset_name}, bundle=${bundleManifest['eval-dataset']?.dataset_name}`,
)

// py_compile on extracted python sources
const tmpDir = join(root, '.cursor', 'cycles', 'cycle-51', '_py_extract')
try {
  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })
  const pyFiles = buildExportBundle(doc, projectJson, '', 'python')
  for (const [rel, content] of Object.entries(pyFiles)) {
    if (rel.endsWith('.py')) {
      const out = join(tmpDir, rel)
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, content)
    }
  }
  try {
    execSync(`python -m compileall -q "${tmpDir}"`, { encoding: 'utf8' })
    check('EXP-CHK-12', 'py_compile on generated Python modules', true, `compileall ${tmpDir}`)
  } catch (e) {
    check('EXP-CHK-12', 'py_compile on generated Python modules', false, e.stderr || e.message)
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true })
}

// Round-trip: langsmith.json + project json node count
const ls = JSON.parse(buildExportBundle(doc, projectJson, '', 'python')['langsmith.json'])
check(
  'EXP-CHK-13',
  'langsmith.json has project metadata',
  Boolean(ls && (ls.project_name || ls.name || ls.metadata)),
  JSON.stringify(ls).slice(0, 150),
)

const failed = results.filter((r) => !r.pass)
console.log('\n--- SUMMARY ---')
console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`)
process.exit(failed.length ? 1 : 0)
