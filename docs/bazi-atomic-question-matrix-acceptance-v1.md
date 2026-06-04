# Bazi Atomic Question Matrix Acceptance v1

## Purpose

This document freezes the Phase 1 acceptance proof for the atomic question matrix before resolver or packet-composer implementation begins.
It is a reviewable artifact for humans and future adapters, not a runtime resolver.

## Bound Contract

- Matrix version: `phase1c-v1`
- Canonical machine-readable home: `src/lib/bazi/atomic-question-matrix.ts`
- Review inventory: `docs/bazi-atomic-question-inventory-v1.md`
- Scope: acceptance of the matrix itself, not implementation of routing or answer composition

## Acceptance Layers

| Layer | Matrix surface | Reviewer question | Accept when |
| --- | --- | --- | --- |
| Bucket | `canonicalBucket` | Which domain lane owns this ask first? | The lane is domain-level only and does not quietly answer timing, result, or profile by itself. |
| Atomic question | `jobId`, `underlyingJob`, `keepSeparateFrom` | What is the narrowest sinsae job being answered? | The job is smaller than the bucket, names one real task, and stays intentionally separate from adjacent jobs. |
| Proof dimension | `mandatoryEvidence`, `forbiddenNoise`, `readingOrder`, `supportStatus`, `supportNotes` | What proof makes this job safe, and what must stay out? | Evidence, exclusions, order, and honesty level are explicit enough that a reviewer can falsify overreach early. |

## Phase 1 Acceptance Criteria

- Every matrix entry exposes one canonical bucket and one atomic job without collapsing back into a bucket-level catch-all.
- Every atomic job states what it must answer and what it must not answer.
- Every atomic job names a mandatory evidence set, a forbidden-noise set, and a reading order.
- `keepSeparateFrom` is defensible for adjacent jobs that might otherwise collapse into one shape.
- `supportStatus` is honest: unsupported or weakly supported jobs must stay partial or insufficient instead of borrowing certainty from a nearby shape.
- Cross-domain prompts decompose before any answer logic is allowed to compose them.
- At least one safe fallback path exists for ambiguous wording, and it does not invent unsupported certainty.

## Falsification Questions

### 1. Duplicate falsification

- If two jobs share the same underlying job, mandatory evidence, forbidden noise, and reading order, what justifies keeping both?
- If the only difference between two jobs is wording intensity or example phrasing, should they merge?
- Can one job answer the other without adding any new proof dimension? If yes, separation is probably fake.

### 2. Over-broad shape falsification

- Does one job try to answer more than one of these at once: profile, timing, result, caution, or viability?
- Does a bucket lane silently substitute for an atomic job?
- Does a job promise a broad life read when the matrix only supports a narrow domain task?

### 3. Unsupported shape falsification

- Does `mustAnswer` imply certainty that the current support status cannot defend?
- Does a `partial` or `insufficient` job still sound like a dedicated resolver already exists?
- Is the job asking for a person-specific, event-specific, or windfall-specific claim without a safe proof surface?

### 4. Hidden forbidden drift falsification

- Can romance, money, family, diagnosis, or employer-specific claims leak into the answer without being named in `forbiddenNoise`?
- Does the reading order smuggle in a different domain before proving the main job?
- Does a cross-domain prompt create a hidden extra job instead of decomposing into explicit jobs first?

## Safe Ambiguity Fallback

Ambiguous wording is acceptable only when the matrix offers a safe low-claim path or an explicit blocker.

### Fallback rule

1. If the prompt explicitly spans multiple domains, apply `crossDomainDecomposition` first.
2. If the wording is broad and does not justify a narrow profile, result, or timing claim, prefer a foundation-level fallback instead of guessing a sharper job.
3. If no safe narrow job or foundation fallback exists, Phase 2 must treat the prompt as unresolved and refuse fake certainty.

### Safe fallback examples

| Ambiguous wording | Safe fallback | Why it is safe | What must not happen |
| --- | --- | --- | --- |
| `ปีนี้ชีวิตโดยรวมควรโฟกัสอะไร` | `foundation.general_timing_focus` | The ask is broad, phase-oriented, and not yet narrow enough for a domain-specific outcome job. | Do not guess `wealth.timing_window` or `relationship.timing_window` without explicit domain evidence. |
| `ช่วงนี้ควรระวังอะไรเป็นพิเศษ` | `foundation.general_caution` | The ask is caution-led and domain-unspecified, so the matrix has a safe broad caution lane. | Do not invent health diagnosis, relationship accusation, or investment advice just because the prompt is vague. |

## Phase 2 Usability Checklist

Phase 2 may treat the matrix as usable only when all checklist items below pass.

- [ ] A reviewer can name `canonicalBucket` and `jobId` separately for sample prompts without conflating them.
- [ ] Every accepted job can point to at least one mandatory evidence surface that already exists in the current truth stack.
- [ ] Every accepted job has a readable `forbiddenNoise` boundary that blocks obvious domain drift.
- [ ] Every accepted job has a reading order that is specific enough for later packet composition.
- [ ] `partial` and `insufficient` jobs remain weaker than `supported` jobs in wording and acceptance expectations.
- [ ] Cross-domain prompts can be split deterministically before packet composition starts.
- [ ] Broad or ambiguous wording has either a safe fallback path or an explicit unresolved/blocker path.
- [ ] Reviewers can explain why adjacent jobs in `keepSeparateFrom` must remain separate.

## Review Outcome Contract

Phase 1 closes only when reviewers can answer all of the following with evidence from the matrix and review docs:

- Which bucket owns the ask first?
- Which atomic job is being answered?
- Which proof dimensions make the answer safe?
- Which adjacent jobs remain intentionally separate?
- What fallback or blocker applies when the wording is still ambiguous?

If any answer depends on adapter wording, hidden intuition, or future resolver logic, Phase 1 is not accepted yet.