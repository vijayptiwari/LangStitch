# SDLC Orchestration Plan — Pilot

| Parameter | Value |
|-----------|--------|
| Cycles | **1** (pilot) |
| Cycle theme | **LangSmith eval & trace integration MVP** |
| UAT threshold | ≥ **85 / 100** |
| Max develop-loop iterations | 5 |
| Auto-approve BRD/LLD | **yes** (user pre-approved) |
| Auto-push after UAT | **yes** (user pre-approved) |
| Repos | LangStitch (`lg-canvas`) |
| Skill | `langstitch-sdlc-cycle` |

## Agents loaded

1. sdlc-orchestrator
2. market-feature-researcher
3. feature-lld-architect
4. feature-implementer
5. code-reviewer
6. export-codegen-validator
7. feature-automation-author
8. feature-uat-hard-checker
9. release-docs-ci-steward

## Pilot success criteria

Validate the full pipeline end-to-end: BRD → LLD → implement → CR → export → automate → UAT ≥85 → release-ready (push optional).
