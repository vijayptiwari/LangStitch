#!/usr/bin/env node
/**
 * Generates cycle themes for SDLC batch 11–2500.
 * Each theme is a compact micro-feature (one commit per cycle).
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', '.cursor', 'cycles', 'cycle-themes.json');

const CATEGORIES = [
  {
    id: 'toolbar',
    templates: [
      'Add {n} tooltip to toolbar {action} button',
      'Show keyboard hint on toolbar {action}',
      'Disable toolbar {action} when graph is empty',
      'Add aria-label to toolbar {action}',
      'Persist toolbar {action} last-used option',
    ],
    actions: ['save', 'export', 'undo', 'redo', 'zoom-in', 'zoom-out', 'fit-view', 'platform'],
  },
  {
    id: 'platform',
    templates: [
      'Add loading skeleton to Platform {tab} tab',
      'Show last-sync timestamp on Platform {tab}',
      'Add retry button on Platform {tab} API error',
      'Collapse/expand Platform {tab} section',
      'Copy-to-clipboard for Platform {tab} output',
    ],
    tabs: ['Git', 'Export', 'Deploy', 'Eval', 'Health'],
  },
  {
    id: 'designer',
    templates: [
      'Add empty-state hint in {designer} designer',
      'Validate required fields in {designer} before save',
      'Show character count on {designer} description field',
      'Add search/filter to {designer} list',
      'Confirm dialog before delete in {designer}',
    ],
    designers: ['Skill', 'Guardrail', 'Rule', 'Persona', 'RAG', 'Graph'],
  },
  {
    id: 'canvas',
    templates: [
      'Snap-to-grid toggle for canvas nodes',
      'Multi-select delete confirmation on canvas',
      'Node duplicate via Ctrl+D on canvas',
      'Edge label truncation with tooltip cycle {n}',
      'Minimap highlight for selected node cycle {n}',
      'Canvas context menu item: {action}',
    ],
    actions: ['copy', 'paste', 'delete', 'align-left', 'align-center', 'bring-forward'],
  },
  {
    id: 'export',
    templates: [
      'Include {field} in langsmith.json export metadata',
      'Add {field} comment header in generated Python module',
      'Export validation warning for missing {field}',
      'Zip manifest lists {field} in export bundle',
      'Export dry-run preview shows {field}',
    ],
    fields: ['version', 'author', 'tags', 'eval-dataset', 'trace-project', 'runtime-deps'],
  },
  {
    id: 'api',
    templates: [
      'Extend GET /api/health with {field}',
      'Add request ID header to platform API responses',
      'Rate-limit friendly error message on {endpoint}',
      'OpenAPI-style description for {endpoint}',
      'CORS preflight support for {endpoint}',
    ],
    fields: ['build-time', 'node-count', 'export-count', 'uptime', 'memory-usage'],
    endpoints: ['/api/export', '/api/eval/run', '/api/git/push', '/api/deploy'],
  },
  {
    id: 'eval',
    templates: [
      'Eval runner shows {metric} in result panel',
      'Eval config preset: {preset}',
      'Eval dry-run badge when API key missing',
      'Eval history last-{n} runs in session',
      'Link eval dataset name in result summary',
    ],
    metrics: ['latency-ms', 'token-count', 'pass-rate', 'run-id', 'experiment-name'],
    presets: ['smoke', 'regression', 'full-suite', 'custom'],
  },
  {
    id: 'a11y',
    templates: [
      'Focus trap in modal cycle {n}',
      'Skip link to main canvas region',
      'High-contrast focus ring on {component}',
      'Screen-reader live region for {event}',
      'Reduce-motion respect for {animation}',
    ],
    components: ['toolbar', 'drawer', 'node palette', 'shortcuts modal'],
    events: ['save success', 'export complete', 'eval finished', 'deploy started'],
  },
  {
    id: 'shortcuts',
    templates: [
      'Keyboard shortcut Ctrl+{key} for {action}',
      'Shortcuts modal documents {action}',
      'Chord shortcut Alt+{key} for {action}',
    ],
    keys: ['E', 'G', 'D', 'H', 'L', 'P', 'K'],
    actions: ['toggle platform', 'focus search', 'toggle minimap', 'open eval tab', 'duplicate node'],
  },
  {
    id: 'store',
    templates: [
      'Graph store persists {field} in localStorage',
      'Undo stack depth limit with user notice',
      'Merge imported {field} on project load',
      'Dirty flag clears after successful {action}',
    ],
    fields: ['viewport', 'selected-node', 'panel-widths', 'recent-files'],
    actions: ['save', 'export', 'import'],
  },
  {
    id: 'docs',
    templates: [
      'README section: {topic}',
      'CHANGELOG entry template for cycle {n}',
      'Inline JSDoc on {module} public API',
      'Help tooltip links to docs for {feature}',
    ],
    topics: ['eval runner', 'export formats', 'keyboard shortcuts', 'platform API', 'RAG nodes'],
    modules: ['platformClient', 'graphStore', 'pythonProjectGenerator', 'eval_service'],
  },
  {
    id: 'e2e',
    templates: [
      'E2E test: {scenario} user flow',
      'E2E assertion for {testid} visibility',
      'E2E regression for {feature} after reload',
    ],
    scenarios: ['save-and-reload', 'export-zip', 'eval-dry-run', 'open-shortcuts', 'platform-git-tab'],
    features: ['toolbar dirty state', 'eval summary', 'health metadata', 'export format memory'],
  },
];

function pick(arr, i) {
  return arr[i % arr.length];
}

function expandTemplate(tpl, cycle, cat, idx) {
  return tpl
    .replace(/\{n\}/g, String(cycle))
    .replace(/\{action\}/g, pick(cat.actions ?? cat.tabs ?? cat.designers ?? cat.fields ?? cat.keys ?? ['item'], idx))
    .replace(/\{tab\}/g, pick(cat.tabs ?? ['General'], idx))
    .replace(/\{designer\}/g, pick(cat.designers ?? ['Asset'], idx))
    .replace(/\{field\}/g, pick(cat.fields ?? ['metadata'], idx))
    .replace(/\{endpoint\}/g, pick(cat.endpoints ?? ['/api/health'], idx))
    .replace(/\{metric\}/g, pick(cat.metrics ?? ['status'], idx))
    .replace(/\{preset\}/g, pick(cat.presets ?? ['default'], idx))
    .replace(/\{component\}/g, pick(cat.components ?? ['UI'], idx))
    .replace(/\{event\}/g, pick(cat.events ?? ['update'], idx))
    .replace(/\{key\}/g, pick(cat.keys ?? ['X'], idx))
    .replace(/\{animation\}/g, pick(['transitions', 'zoom', 'panel slide'], idx))
    .replace(/\{topic\}/g, pick(cat.topics ?? ['feature'], idx))
    .replace(/\{module\}/g, pick(cat.modules ?? ['core'], idx))
    .replace(/\{scenario\}/g, pick(cat.scenarios ?? ['basic'], idx))
    .replace(/\{testid\}/g, pick(['platform-drawer', 'eval-run-btn', 'toolbar-save', 'shortcuts-modal'], idx))
    .replace(/\{feature\}/g, pick(cat.features ?? ['core'], idx));
}

function generateTheme(cycle) {
  const cat = CATEGORIES[(cycle - 11) % CATEGORIES.length];
  const tplIdx = Math.floor((cycle - 11) / CATEGORIES.length) % cat.templates.length;
  const tpl = cat.templates[tplIdx];
  const feature = expandTemplate(tpl, cycle, cat, cycle);
  return {
    cycle,
    category: cat.id,
    feature,
    mode: 'compact',
    size: 'micro',
  };
}

const completed = Array.from({ length: 10 }, (_, i) => ({
  cycle: i + 1,
  status: 'COMPLETE',
  note: '10-cycle pilot',
}));

const pending = [];
for (let c = 11; c <= 2500; c++) {
  pending.push({ ...generateTheme(c), status: 'PENDING' });
}

const registry = {
  version: 1,
  totalCycles: 2500,
  completedCount: 10,
  pendingCount: 2490,
  batchSize: 10,
  autoApprove: true,
  autoPush: true,
  uatThreshold: 85,
  completed,
  cycles: pending,
};

writeFileSync(OUT, JSON.stringify(registry, null, 2));
console.log(`Wrote ${pending.length} themes to ${OUT}`);
