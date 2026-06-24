---
name: langstitch-sdlc-cycle
description: LangStitch end-to-end SDLC cycle playbook — artifact paths, agent sequence, develop-loop gates (code review, export validation, automation PASSED, UAT ≥85), report templates, and escalation rules. Use when running sdlc-orchestrator, starting a feature cycle, or when the user asks for LangStitch SDLC workflow, cycle artifacts, or pipeline gates.
---

# LangStitch SDLC Cycle

Canonical playbook for **sdlc-orchestrator** and anyone running a feature cycle on LangStitch (`lg-canvas`).

## Quick start

1. Read `.cursor/agents/sdlc-orchestrator.md` and invoke orchestrator with **N cycles** + themes.
2. Store artifacts under `.cursor/cycles/cycle-{k}/` (create if missing).
3. Follow agent order below — **do not skip gates**.
4. Cycle **COMPLETE** only when all exit gates pass.

## Agent sequence (9 agents)

| Step | Agent | Gate |
|------|-------|------|
| 1 | market-feature-researcher | User picks feature from BRD |
| 2 | feature-lld-architect | User approves LLD |
| 3 | feature-implementer | Delivery handoff ready |
| 3c | code-reviewer | **APPROVED** (no open Critical CR-*) |
| 3d | export-codegen-validator | **VALIDATED** or **N/A** |
| 3e | feature-automation-author | **PASSED** (full e2e green) |
| 4 | feature-uat-hard-checker | **score ≥ 85**, P0 clear |
| 5 | release-docs-ci-steward | CI green; user confirms push |

## Develop loop (core)

```
Implement → Code review → Export validate* → Automate → UAT
     ↑           ↓ fail CR-*     ↓ fail EXP-*    ↓ fail GAP-*
     └───────────┴───────────────┴───────────────┘
     
UAT fail (DEF-*) → Automate gap-only (AUTO-DEF-*) → Implement → …
```

\*Skip export validate when LLD §5 / diff has no codegen/export changes.

### Gate rules (non-negotiable)

| Gate | Pass | Fail → |
|------|------|--------|
| Code review | APPROVED | implementer fixes **CR-*** |
| Export | VALIDATED or N/A | implementer fixes **EXP-*** |
| Automation | PASSED | implementer fixes **GAP-***; **no UAT** |
| UAT | score ≥ 85, P0=0 | gap automation **DEF-*** → implementer |

Max **5** develop-loop iterations per cycle (orchestrator default).

## Cycle artifacts

Create and update each cycle:

```
.cursor/cycles/cycle-{k}/
├── BRD.md
├── LLD.md
├── delivery-{n}.md          # implementer handoff
├── code-review-{n}.md
├── export-validation-{n}.md
├── automation-package-{n}.md
├── uat-report-{n}.md
└── cycle-summary.md         # written at COMPLETE or ESCALATED
```

Copy agent report bodies into these files when committing cycle history.

## Cycle init checklist

```
- [ ] N cycles and themes confirmed
- [ ] cycle-{k} directory created
- [ ] Orchestration Plan posted in chat
- [ ] Auto-approve BRD/LLD? (default: no)
- [ ] Auto-push? (default: no)
```

## Per-iteration state block

Post in every orchestrator turn:

```markdown
### SDLC State — Cycle k/N
- Phase: [research | lld | implement | code-review | export | automate | uat | release]
- Delivery: n | Loop: m / 5
- Last verdicts: CR=APPROVED | EXP=N/A | Auto=PASSED | UAT=72/100
- Blockers: [CR-001 | EXP-002 | GAP-003 | DEF-004 | none]
- UAT allowed this iteration: yes | no (why)
```

## Report templates (minimal headers)

### cycle-summary.md (on COMPLETE)

```markdown
# Cycle k — COMPLETE | ESCALATED | ABORTED
- Feature:
- UAT score:
- Loops: 
- Commits:
- CI:
- Live URLs:
```

### Master SDLC Report (after N cycles)

```markdown
# Master SDLC Report
| Cycle | Feature | CR | Export | Auto | UAT | Loops | Release | Status |
```

## Verification commands (LangStitch)

```bash
npm run build
npm run test:e2e
npm run test:e2e -- e2e/<feature>.spec.ts
python runtime/basic_agent.py
```

CI mirror: `.github/workflows/ci.yml`

## ID prefix reference

| Prefix | Agent | Routed to |
|--------|-------|-----------|
| CR-* | code-reviewer | feature-implementer |
| EXP-* | export-codegen-validator | feature-implementer |
| GAP-* | feature-automation-author | feature-implementer |
| DEF-* | feature-uat-hard-checker | automate gap-only → implementer |

## Escalation triggers

- 5 loops exhausted with open GAP/DEF/EXP/CR
- Automation BLOCKED 2× on same missing testid
- CI red 3× after release-docs-ci-steward
- User aborts cycle

## Compact mode

User says `auto-approve BRD/LLD`: skip steps 1–2 user pauses.

**Never skip:** code review → export (if in scope) → automation PASSED → UAT ≥ 85.

## Related resources

- Export validation detail: [export-verify.md](export-verify.md)
- Agents: `.cursor/agents/*.md`

## Invoke examples

```
Run sdlc-orchestrator for 1 cycle, theme: eval hooks. Follow langstitch-sdlc-cycle skill.
```

```
Start cycle 2 — create artifact folder and post SDLC State.
```
