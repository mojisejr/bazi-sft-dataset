# Bazi Testing Gates

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
| `tests/real-case-1981-03-17.test.ts` | Recomputes the same chart and graph truth across many assertions, so it is a poor fit for day-to-day continuity until Phase 3 reduces duplication. |
| `tests/compile-knowledge.test.ts` | Builds the compiled topic artifact from the full distilled corpus, which is broad build truth rather than a narrow runtime check. |
| `tests/canonical-knowledge.test.ts` | Builds and validates the full canonical dataset from the corpus, including large record counts and generated solar-term truth. |
| `tests/solar-terms.test.ts` | Generates full-range deterministic solar-term payloads, including the 1900-2100 seed rows, which is corpus-wide verification work. |
| `tests/orchestrator-gemini-runner.test.ts` | Exercises sequential multi-chunk orchestration over a calculated chart and retry flow, making it broader and slower than the default runtime baseline. |

This list is temporary mission state. Keep future updates in Oracle memory artifacts if the excluded set changes during later phases.