# Market research summary — LangStitch — 2026-06-23

## Use case & persona

**Job-to-be-done:** Ship a LangGraph agent from visual design to production with confidence that behavior matches intent — including **measurable quality** via evals, not only tracing.

**Primary persona:** Agent team lead / platform engineer who self-hosts LangStitch, exports Python to Git, and uses **LangSmith** (or Langfuse) for observability — but today must leave the IDE to run dataset evals in LangSmith Studio or SDK scripts.

**Environment:** Self-host IDE + exported Python repo; LangSmith cloud or self-hosted for evals/traces.

**Success for product:** Close the compare-page gap on *"Eval datasets & trace replay (LangSmith depth)"* without rebuilding LangSmith — **integrate** eval workflow into LangStitch export + platform ops.

---

## Competitive landscape

| Product | Core USP | Strengths to absorb | Weaknesses / lock-in | Relevance |
|---------|----------|---------------------|----------------------|-----------|
| **LangGraph Studio + LangSmith** | Native graph debugging + evals | Run evals from Studio UI on pinned datasets; add thread nodes to datasets; LLM-as-judge evaluators in UI ([docs](https://docs.langchain.com/langsmith/observability-studio)) | Cloud-first; assumes LangSmith project | **H** |
| **LangSmith SDK** | `evaluate()` / `aevaluate()` on datasets ([docs](https://docs.langchain.com/langsmith/evaluate-graph)) | Programmatic eval for CI; metadata for experiments | Requires Python scripting outside IDE | **H** |
| **Langflow / Flowise** | Fast prototyping | Component eval hooks emerging | Weak LangGraph-native export | M |
| **Dify / n8n** | Hosted workflows + app evals | No-code test sets | Not LangGraph/Git export path | L |
| **Hand-rolled LangGraph** | Full control | Custom pytest + LangSmith in CI | No visual eval config | M |

---

## Synthesis: table stakes vs whitespace

### Table stakes (users expect)
- Tracing to LangSmith/Langfuse — **LangStitch has** (Graph Designer observability + export codegen)
- Run agent locally / via platform API — **LangStitch has** (`/api/agent/run`, runtime smoke)
- **Dataset-backed eval runs** — **LangStitch lacks** (compare page marks as roadmap gap)

### Whitespace (LangStitch can win)
- **Eval config travels with export** — `langsmith.json` + generated `eval_runner.py` for CI, not just UI-only
- **Production-first eval trigger** — Platform drawer launches eval against exported project using env-based API keys
- **Honest integration** — don't clone LangSmith eval UI; orchestrate SDK + deep links

### Anti-patterns (reject)
- Rebuilding full LangSmith eval editor inside LangStitch
- SaaS-only eval storage that breaks Git export workflow

---

## Selected features (max 2)

| # | Feature | Alignment scores (use-case / strategic / competitive / diff / MVP / cost) | Pass |
|---|---------|---------------------------------------------------------------------------|------|
| **1** | **LangSmith Eval Runner MVP** | 5 / 5 / 5 / 4 / 4 / 3 | ✅ **Recommend for pilot** |
| **2** | **Eval config in export + CI smoke** | 4 / 5 / 4 / 5 / 4 / 2 | ✅ Complementary (can bundle with #1) |

**Deferred:** Full trace replay UI, collaboration, template marketplace (too large for pilot).

---

# BRD: LangSmith Eval Runner MVP

### 1. Executive summary

LangStitch users can configure LangSmith tracing today but must **leave the IDE** to run dataset evaluations. LangGraph Studio runs evals against pinned datasets from the UI ([LangSmith Studio docs](https://docs.langchain.com/langsmith/observability-studio)). This MVP adds an **Eval Runner** panel in the Platform drawer: link a LangSmith dataset, configure experiment metadata, trigger an eval run via platform API against the exported graph, and **persist eval config in `langsmith.json` + export** for CI (`langsmith.evaluate` pattern).

### 2. Problem statement

- **Job:** Validate agent changes against a regression dataset before merge/deploy.
- **Pain:** Compare page lists *"Eval datasets & trace replay"* as a gap; observability settings exist in `GraphDesigner.tsx` but no eval execution path.
- **Who:** Team leads exporting Python from LangStitch and using LangSmith for quality gates.

### 3. Market evidence

- LangGraph Studio: select dataset → run experiment → evaluators run automatically ([source](https://docs.langchain.com/langsmith/observability-studio)).
- LangSmith SDK: `aevaluate(target, data=dataset, evaluators=[...])` ([source](https://docs.langchain.com/langsmith/evaluate-graph)).
- LangStitch today: `ObservabilityConfig` + LangSmith fields in `graph.ts`, codegen in `pythonGenerator.ts` / `pythonProjectGenerator.ts` — **export only, no eval runner**.

### 4. Proposed solution (MVP — ~1 month)

**In scope**
- New **Eval** tab in Platform drawer (`PlatformDrawer.tsx`)
- Fields: dataset name/UUID, experiment prefix, max concurrency, optional evaluator reference (name only — evaluators stay in LangSmith UI)
- **Run eval** button → `POST /api/eval/run` → invokes LangSmith SDK wrapper on exported project
- Persist `evalConfig` on graph document / `langsmith.json`
- Codegen: emit `eval_runner.py` + document env vars (`LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT`)
- Graph Designer: show linked dataset summary under observability section
- Docs + compare page row update: gap → *"Eval runner (LangSmith integration)"*

**Out of scope (phase 2)**
- Visual evaluator builder, trace replay timeline, add-to-dataset from canvas
- Langfuse eval parity
- Offline eval without LangSmith account

### 5. Alignment with LangStitch pillars

| Pillar | How |
|--------|-----|
| **Production support** | Eval config in Git export; CI can run `python -m eval_runner` |
| **Developer experience** | One-click eval from IDE; no separate script authoring for happy path |

### 6. Functional requirements

| ID | Requirement |
|----|-------------|
| **FR-1** | User opens Platform drawer → **Eval** tab and sees eval configuration form |
| **FR-2** | User saves dataset name/UUID and experiment prefix; values persist in project save/load |
| **FR-3** | User clicks **Run eval**; platform shows running/success/failure with experiment URL or run id |
| **FR-4** | Eval config is included in `langsmith.json` on export |
| **FR-5** | Exported Python project includes `eval_runner.py` (or equivalent) callable with documented env vars |
| **FR-6** | When LangSmith is disabled in observability settings, Eval tab shows clear disabled state |
| **FR-7** | Invalid/missing API key returns user-visible error (no silent failure) |

### 7. Non-functional requirements

| ID | Requirement |
|----|-------------|
| **NFR-1** | Eval run request timeout ≤ 120s with progress indicator |
| **NFR-2** | No API keys stored in repo — env var names only |
| **NFR-3** | Export round-trip preserves eval config |
| **NFR-4** | Dark theme consistent with platform drawer |

### 8. Success metrics (KPIs)

| KPI | Today | Target after MVP |
|-----|-------|------------------|
| Time to first eval from IDE | N/A (external) | < 5 min with LangSmith key set |
| Eval config survives export/import | No | 100% round-trip |
| Compare page eval gap | Roadmap | Shipped integration MVP |

### 9. User stories

1. **As a** team lead, **I want** to run my graph against a LangSmith dataset from the IDE **so that** I catch regressions before export.
2. **As a** platform engineer, **I want** eval config in the exported repo **so that** CI runs the same eval as the IDE.
3. **As a** developer without LangSmith, **I want** a clear disabled state **so that** I know evals require observability setup.

### 10. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| LangSmith API changes | Thin adapter module; pin SDK version in server requirements |
| Long-running evals | Async job + poll status in phase 2; MVP cap with timeout + link to LangSmith UI |
| Scope creep (full eval UI) | BRD out-of-scope list; integrate don't replicate |

### 11. Rollout & validation

- Update `site/index.html#compare` eval row
- README section: Eval Runner setup
- Validate: run eval against LangSmith public test dataset in dev

### 12. Open questions

1. Require LangSmith SDK in `server/requirements.txt` vs subprocess to exported venv?
2. Support dataset UUID only or name lookup via API?

---

# BRD: Eval config in export + CI smoke (bundled slice)

If pilot scope needs to stay smaller, ship **FR-4, FR-5, NFR-3 only** (export + codegen + round-trip) without live **Run eval** API — still closes part of the gap.

| ID | Requirement |
|----|-------------|
| **FR-E1** | `evalConfig` type on graph document |
| **FR-E2** | `langsmith.json` includes eval section |
| **FR-E3** | `eval_runner.py` generated; `python eval_runner.py --dry-run` validates config |

**Recommendation:** Pilot cycle implements **full Eval Runner MVP (Feature 1)** including export slice.

---

## Recommended next step

**User gate:** Confirm **LangSmith Eval Runner MVP** as Cycle 1 feature → hand off to **feature-lld-architect**.
