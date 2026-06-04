# Bazi Testing Gates

## Open WebUI Post-Phase-3 Baseline

Use this baseline when the touched surface is the Open WebUI integration lane:

- `src/app/api/v1/chat/completions/route.ts`
- `src/features/open-webui/chat-runner.ts`
- `src/features/open-webui/episodic-service.ts`
- `src/features/open-webui/gemini-adapter.ts`
- `src/features/open-webui/truth-packet.ts`

The accepted post-Phase-3 gate for that lane is:

1. `npm run gate:open-webui`

`npm run gate:open-webui` expands to:

1. `npm run build`
2. `npm run lint`
3. `npm run test:open-webui`

For operational regression classification before reopening browser truth, run:

1. `npm run test:open-webui-regression`

`npm run test:open-webui-regression` is the minimal backend-lane pack for:

- request identity forwarding and thread normalization
- continuity reset / fail-closed behavior
- finalized persistence vs explicit skip reasons

The accepted runtime-only proof is already closed for the current local Open WebUI setup:

- same-thread refresh/resume
- finalized-write persistence after reload
- new-profile isolation

Treat older Open WebUI blocker narratives as historical-only unless fresh failing evidence appears. This includes the pre-closure `BT-10` blocker wording, `browser-truth-open` style status, and earlier recovery notes that assumed the local shell was still unproven.

Do not reopen correctness internals from those historical notes by default. After this baseline, rerun browser truth only when deterministic gates pass but a runtime-only uncertainty still survives.

## Release Packaging Boundary For Open WebUI Lane

When packaging the Open WebUI release slice for review:

- include the migration, production code, and deterministic test surfaces that belong to the closed Phase 3/Phase 4 chain
- use `npm run gate:open-webui` as the canonical review gate for this lane
- exclude repo-local runtime artifacts such as `.playwright-mcp/**` from the code change set

The `.playwright-mcp/` directory is a local QA evidence sink, not release material. Keep runtime screenshots, text captures, and JSON reports there only as local evidence unless a human explicitly asks to ship them.

## Default Developer Gate

Use `npm run gate:default` as the canonical continuity gate for ordinary feature work.

It expands to:

1. `npm run build`
2. `npm run lint`
3. `npm run test:default-gate`

`npm run test:default-gate` currently resolves to `npm run test:runtime-critical`, which protects the runtime-critical deterministic surfaces below:

- `tests/symbolic-engine.test.ts`
- `tests/symbolic-engine.e2e.test.ts`
- `tests/schema.test.ts`
- `tests/dataset-save-route.test.ts`
- `tests/dataset-purge-drafts-route.test.ts`

When the changed surface already has a nearby fast test, run that focused slice on top of the default gate with `npx vitest run <affected test file>`.

## Heavy Verification Lane

Use `npm run gate:heavy-lane` only after `npm run gate:default` passes and the change touches corpus-wide, build-wide, or broad deterministic-generation surfaces.

`npm run gate:heavy-lane` expands to:

1. `npm run test:heavy-lane`
2. `npm run build:knowledge`

`npm run test:heavy-lane` currently covers these broad deterministic suites:

- `tests/real-case-1981-03-17.test.ts`
- `tests/compile-knowledge.test.ts`
- `tests/canonical-knowledge.test.ts`
- `tests/solar-terms.test.ts`
- `tests/orchestrator-gemini-runner.test.ts`

When this command runs, it also switches Vitest into the explicit `heavy` profile via `VITEST_BAZI_PROFILE=heavy`, which currently:

- disables file-level parallelism
- limits concurrency to one test task at a time
- raises `testTimeout` and `hookTimeout` to 30 seconds

This tuning belongs only to the heavy lane. The default gate keeps the normal Vitest behavior so day-to-day continuity does not inherit heavyweight runner policy.

`npm test` remains available as a full-suite exploratory signal, but it is not the canonical continuity gate for unrelated feature slices.

## Trigger Rules

Run the heavy lane when work touches one or more of these classes:

- compiled knowledge builders or corpus normalization
- solar-term generation or other full-range deterministic seed payloads
- seeding / generated artifact flows
- orchestration paths that validate sequential multi-chunk draft generation across the full 15-topic contract

Stay on the default gate when the change is limited to runtime-critical app behavior and does not rebuild broad corpus truth.

## Current Known-Red Exclusions From Default Gate

These suites are intentionally excluded from the default gate during the hardening mission because they exercise broad deterministic truth and currently cost too much for ordinary feature continuity:

| Suite | Why it is excluded from default gate for now |
|---|---|
| `tests/real-case-1981-03-17.test.ts` | Phase 3 reduced duplication by caching the shared chart and graph fixture, but the suite still freezes a broad integration reading surface that is heavier than the default runtime baseline. |
| `tests/compile-knowledge.test.ts` | Phase 3 reduced duplication by caching the compiled artifact within the file, but the suite still validates a broad corpus build rather than a narrow runtime check. |
| `tests/canonical-knowledge.test.ts` | The file already caches the canonical dataset, but it still validates the full corpus with large record counts and generated solar-term truth. |
| `tests/solar-terms.test.ts` | Generates full-range deterministic solar-term payloads, including the 1900-2100 seed rows, which is corpus-wide verification work. |
| `tests/orchestrator-gemini-runner.test.ts` | Phase 3 reduced duplication by reusing the calculated chart fixture, but the suite still exercises sequential multi-chunk orchestration and retry flow across the full 15-topic contract. |

This list is temporary mission state. Keep future updates in Oracle memory artifacts if the excluded set changes during later phases.