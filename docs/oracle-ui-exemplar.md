# Bazi Oracle UI Exemplar

This document defines how Bazi now represents the canonical Oracle UI layering model in code truth.

## Why This Exists

Phase 2 proved the token and foundation split.
Phase 3 proved the primitive vocabulary on real Bazi surfaces.
Phase 4 turns those implementation results into a contributor-readable reference so future UI work does not drift back into one oversized stylesheet.

## Layer Map

### 1. Reference Tokens

- Path: `src/styles/tokens/reference.css`
- Owns:
  - raw color values
  - spacing scales
  - radius scales
  - shadow/material source values
- Rule:
  - use this layer when the change is about a raw visual constant, not a semantic UI role

### 2. System Tokens

- Path: `src/styles/tokens/system.css`
- Owns:
  - semantic surfaces
  - text roles
  - line emphasis roles
  - state tones such as success/danger/accent
- Rule:
  - use this layer when the change is about meaning, not about one exact color value

### 3. Foundation

- Path: `src/styles/foundation.css`
- Owns:
  - root/base element defaults
  - app shell background and body behavior
  - minimal app-wide structure that should exist before any feature renders
- Rule:
  - do not place reusable panel/button/form recipes here

### 4. Primitives

- Paths:
  - `src/styles/primitives.css`
  - `src/components/bazi/primitives/`
- Owns:
  - reusable structural CSS recipes
  - reusable React wrappers for shared interaction and hierarchy
- Current primitive families:
  - `Surface`
  - `SectionHeading`
  - `ActionButton` / `ActionLink`
  - `Badge`
  - `StatusChip`
  - field/action/surface/rail selector families in `primitives.css`
- Rule:
  - promote a recipe here only when it serves multiple real surfaces or clearly defines a reusable interaction family

### 5. Feature Composition

- Path: `src/components/bazi/`
- Owns:
  - Bazi-specific flows and composition
  - domain sequencing and content hierarchy
  - feature-local layout decisions that are not yet reusable across multiple surfaces
- Rule:
  - feature components should compose tokens and primitives instead of owning raw visual constants directly

### 6. Spillover

- Path: `src/styles/bazi-spillover.css`
- Owns:
  - temporary migration inventory
  - selectors that remain feature-local or still need proof before promotion into primitives
- Rule:
  - this file is allowed, but it is not the target architecture
  - do not add new shared structural families here if they already belong in primitives

## Where To Put A Change

| If you need to change... | Put it here | Why |
| --- | --- | --- |
| a raw hex/rgba/material constant | `src/styles/tokens/reference.css` | raw value source of truth |
| semantic role like surface, line, accent, success | `src/styles/tokens/system.css` | meaning layer |
| body/app-shell defaults | `src/styles/foundation.css` | global baseline |
| a reusable panel/button/badge/heading/form structure | `src/styles/primitives.css` and/or `src/components/bazi/primitives/` | shared UI grammar |
| a Bazi-only screen composition detail | the relevant file under `src/components/bazi/` | feature ownership |
| a not-yet-reusable legacy selector | `src/styles/bazi-spillover.css` | temporary migration holding area |

## Current Canonical Examples

- Shell surface and operator state:
  - `src/components/bazi/SystemHeader.tsx`
- Intake form and case rail:
  - `src/components/bazi/BirthForm.tsx`
- Pending queue and queue actions:
  - `src/components/bazi/PendingDraftQueue.tsx`
  - `src/components/bazi/QueueCasePreviewButton.tsx`
- Reading surface primitives in practice:
  - `src/components/bazi/StrengthScoreBreakdown.tsx`
  - `src/components/bazi/CompatibilitySurface.tsx`

## Bazi-Local vs Oracle-Standard

### Bazi-Local

- narrative copy and reading order specific to Bazi workflows
- symbolic-engine-driven data shapes
- queue/proofing terminology such as pending draft, proof, and case preview

### Oracle-Standard Candidates

- reference -> system -> foundation -> primitive -> feature layering
- explicit spillover as temporary migration inventory instead of hidden stylesheet debt
- reusable surface/heading/action/badge/state primitive split
- keeping feature composition free from repeated raw visual values

## Promotion Rule

Promote a selector or component from feature/spillover into primitives only when at least one of these is true:

- it already serves multiple real surfaces
- it captures one reusable interaction family clearly
- keeping it local would duplicate ownership across features

If none are true yet, keep it feature-local and document the constraint instead of forcing premature abstraction.

## Validation Contract For Future UI Refactors

- Deterministic gate:
  - `npm run build`
  - `npm run test`
  - `npm run lint`
- Browser truth when the active plan explicitly requires runtime evidence for hierarchy, responsiveness, overlay behavior, or protected UI flow.

## Migration Note

The existence of `bazi-spillover.css` is not a failure. It is an explicit record of what has not yet earned promotion. The failure mode is letting it silently become the default destination for new shared UI structure.