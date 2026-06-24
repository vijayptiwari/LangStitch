/**
 * Export validation for cycle 75 — eval-dataset in langsmith.json metadata.
 * Run: node scripts/validate-cycle-75-export.mjs
 */
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const { generateLangsmithJson, generatePythonProject } = await import(
  '../src/lib/codegen/pythonProjectGenerator.ts'
)
const { buildExportBundle } = await import('../src/lib/codegen/bundleGenerator.ts')
const { createDefaultDocument, exportGraphDocument } = await import(
  '../src/lib/codegen/pythonGenerator.ts'
)
const { DEFAULT_EVAL } = await import('../src/lib/designerConstants.ts')

const results = []

function check(id, name, pass, evidence) {
  results.push({ id, name, pass, evidence })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${name}`)
  if (evidence) console.log(`  → ${String(evidence).slice(0, 240)}`)
}

function parseLangsmith(doc) {
  return JSON.parse(generateLangsmithJson(doc))
}

// --- With eval + dataset name ---
const doc = createDefaultDocument()
doc.settings = {
  ...doc.settings,
  eval: {
    ...DEFAULT_EVAL,
    enabled: true,
    datasetName: 'batch7_langsmith_ds',
    datasetId: 'ds-cycle75-001',
  },
}

const ls = parseLangsmith(doc)
check(
  'EXP-CHK-1',
  'langsmith.json valid JSON with version 1.0',
  ls.version === '1.0' && typeof ls.langsmith === 'object',
  `version=${ls.version}, langsmith.project_name=${ls.langsmith?.project_name}`,
)
check(
  'EXP-CHK-2',
  'eval-dataset block present when eval enabled with dataset',
  ls['eval-dataset']?.enabled === true,
  JSON.stringify(ls['eval-dataset']),
)
check(
  'EXP-CHK-3',
  'eval-dataset.dataset_name matches graph settings',
  ls['eval-dataset']?.dataset_name === 'batch7_langsmith_ds',
  ls['eval-dataset']?.dataset_name,
)
check(
  'EXP-CHK-4',
  'eval-dataset.dataset_id matches graph settings',
  ls['eval-dataset']?.dataset_id === 'ds-cycle75-001',
  ls['eval-dataset']?.dataset_id,
)
check(
  'EXP-CHK-5',
  'eval block retained alongside eval-dataset',
  ls.eval?.enabled === true && ls.eval?.dataset_name === 'batch7_langsmith_ds',
  JSON.stringify(ls.eval),
)
check(
  'EXP-CHK-6',
  'langsmith.tracing_v2 present',
  ls.langsmith?.tracing_v2 === true,
  String(ls.langsmith?.tracing_v2),
)

// --- Omit when eval disabled ---
const docNoEval = createDefaultDocument()
const lsNoEval = parseLangsmith(docNoEval)
check(
  'EXP-CHK-7',
  'eval-dataset omitted when eval disabled',
  !('eval-dataset' in lsNoEval),
  Object.keys(lsNoEval).join(', '),
)

// --- Omit when enabled but no dataset ---
const docNoDs = createDefaultDocument()
docNoDs.settings = {
  ...docNoDs.settings,
  eval: { ...DEFAULT_EVAL, enabled: true, datasetName: '', datasetId: '' },
}
const lsNoDs = parseLangsmith(docNoDs)
check(
  'EXP-CHK-8',
  'eval-dataset omitted when no dataset name or id',
  !('eval-dataset' in lsNoDs),
  JSON.stringify(lsNoDs.eval),
)

// --- dataset_id only ---
const docIdOnly = createDefaultDocument()
docIdOnly.settings = {
  ...docIdOnly.settings,
  eval: { ...DEFAULT_EVAL, enabled: true, datasetName: '', datasetId: 'uuid-only-ds' },
}
const lsIdOnly = parseLangsmith(docIdOnly)
check(
  'EXP-CHK-9',
  'eval-dataset included with dataset_id only',
  lsIdOnly['eval-dataset']?.enabled === true &&
    lsIdOnly['eval-dataset']?.dataset_id === 'uuid-only-ds',
  JSON.stringify(lsIdOnly['eval-dataset']),
)

// --- Bundle integration ---
const projectJson = exportGraphDocument(doc, [], [], {}, [doc.activeSubgraphId])
for (const format of ['python', 'full']) {
  const files = buildExportBundle(doc, projectJson, '', format)
  const bundleLs = JSON.parse(files['langsmith.json'])
  check(
    `EXP-CHK-10-${format}`,
    `buildExportBundle langsmith.json includes eval-dataset (${format})`,
    bundleLs['eval-dataset']?.dataset_name === 'batch7_langsmith_ds',
    JSON.stringify(bundleLs['eval-dataset']),
  )
  check(
    `EXP-CHK-11-${format}`,
    `bundle contains pyproject.toml and langsmith.json (${format})`,
    'pyproject.toml' in files && 'langsmith.json' in files,
    Object.keys(files).filter((k) => k.endsWith('.toml') || k === 'langsmith.json').join(', '),
  )
}

// --- generatePythonProject embeds same langsmith.json ---
const pyProject = generatePythonProject(doc, projectJson, [], [])
check(
  'EXP-CHK-12',
  'generatePythonProject langsmith.json matches generateLangsmithJson',
  pyProject['langsmith.json'] === generateLangsmithJson(doc),
  pyProject['langsmith.json']?.includes('eval-dataset'),
)

// --- py_compile ---
const tmpDir = join(root, '.cursor', 'cycles', 'cycle-75', '_py_extract')
try {
  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })
  for (const [rel, content] of Object.entries(pyProject)) {
    if (rel.endsWith('.py')) {
      const out = join(tmpDir, rel)
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, content)
    }
  }
  try {
    execSync(`python -m compileall -q "${tmpDir}"`, { encoding: 'utf8' })
    check('EXP-CHK-13', 'py_compile on generated Python modules', true, tmpDir)
  } catch (e) {
    check('EXP-CHK-13', 'py_compile on generated Python modules', false, e.stderr || e.message)
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true })
}

const failed = results.filter((r) => !r.pass)
console.log('\n--- SUMMARY ---')
console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`)
if (failed.length) {
  console.log('Failed:', failed.map((f) => f.id).join(', '))
}
process.exit(failed.length ? 1 : 0)
