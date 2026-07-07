---
name: hard-tasks
description: Opus 4.8 playbook for decomposing hard/ambiguous tasks, verifying its own work layer-by-layer, and deciding what to do next. Use when a task spans many files/systems, when reports and reality may disagree, or when fixes could silently change domain behavior.
---

# Hard Tasks — decompose, verify, decide

Working method distilled from real multi-step engine/dataset work. Three loops, run in order, revisited constantly.

## 1. Decompose — establish reality before touching anything

- **Distrust every artifact until dated and identified.** Folders, dumps, and reports go stale. Before comparing A vs B, confirm *when* each was produced and *what* it actually describes (a folder named after person X may contain person Y — check birth data / primary keys, not filenames).
- **Verify surprising claims from subagents yourself.** Fan out parallel agents for bulk reading (one per subject, structured report format, "conclusions not dumps"). But any claim that would change your plan — "the ground truth itself is wrong" — gets re-derived from primary sources before you repeat it.
- **Read the mechanism, not just the symptom.** Before proposing a fix for "chapter X is empty", trace the full path: outline → resolver → match function → data source → DB rows. Half the "missing features" were wired and working; the evidence was just stale.
- **Classify every gap by the layer it lives in.** The layer determines both the fix and how it can be verified:
  - **data** (tables, seeds, static constants) — fix by authoring/wiring; verifiable by direct execution
  - **wiring** (resolver reads wrong source/key shape) — fix by re-routing; verifiable by tests
  - **guidance** (LLM prompt emphasis) — fix by prompt edit; only verifiable by a real generation run — say so
  - **doctrine** (domain judgment calls) — often *should not* be fixed by you; see §3
- **Prefer wiring existing assets over authoring new content.** Search for an existing table/function that already encodes the answer (a `favorableElements()` nobody plumbed through) before writing new knowledge. Author only when the sweep proves nothing exists — and then keep it static, testable, and marked as prefill for later human curation.

## 2. Verify — at the layer you changed, against ground truth

- **Baseline before judging.** Before your first edit, stash and run the test suite. Record pre-existing failures by name. Your rule is *zero new failures* — not "make everything green" (fixing unrelated red tests mid-task hides your own regressions).
- **Execute end-to-end against ground truth, not just unit tests.** For data-layer changes, run the real engine on real inputs and diff against the master's known-correct output (the 用神 palette matched all three charts exactly — that's the proof, not the passing test).
- **Assert behavior, not shape.** When a change legitimately shifts counts/indices, positional *content* assertions are the safety net that tells you existing behavior survived. Update count assertions with a comment saying why; never loosen content ones.
- **State verification honesty explicitly.** "verified end-to-end" ≠ "tsc passed" ≠ "guidance edited, effect unmeasured until re-run". Report each change with its actual verification level. If an eval ran before your last fix landed, say the numbers exclude it.
- **Clean up as you go.** Temp scripts to scratchpad, removed after use; memory updated the moment a finding is confirmed (identity corrections, doctrine rules, deliberate non-fixes) so the next session doesn't re-derive it.

## 3. Decide next — impact × safety, and knowing when not to act

- **Order work by impact × reversibility.** Canonical-fact plumbing first (fixes many chapters at once, fully testable), content authoring second, prompt guidance third, doctrine changes last or never.
- **A fix that contradicts the domain owner's written intent is a bug.** Before "fixing" a negative reading, check whether the owner explicitly wanted it blunt ("ดีคือดี เสียคือเสีย ห้ามตัดสินบวกเกินจริง" — so the subordinates chapter must *stay* harsh while the family chapter gets the warm frame). Symmetric-looking gaps can have opposite correct fixes.
- **Honor recorded constraints.** Project memory noting "X was deliberately not implemented because docs contradict ground truth" is a stop sign, not a suggestion. Route around it (guidance layer) rather than through it (scoring layer).
- **Ground new content in the master's own words.** When authoring domain text, quote-mine the ground-truth corpus first and reuse its phrasing per case; invent only for the cases it doesn't cover.
- **Ask the user only at real forks.** Measure-vs-build, or which large work item next — those are theirs. Everything with a conventional default: pick it, state it, proceed.
- **End every unit with an honest status table.** What's done at which layer, what's verified vs soft, what remains and why each remaining item is *not* a quick wire (feature / authoring / doctrine). The next decision should be readable off the table.
