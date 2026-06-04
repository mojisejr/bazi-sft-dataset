# Bazi Atomic Question Inventory v1

## Purpose

This document freezes the first draft atomic question inventory for Bazi question routing.
It is a review-first artifact for both current and future adapters.
It groups FAQ phrasings by the underlying sinsae job, not by wording alone.

## Companion Artifacts

- Machine-readable matrix: `src/lib/bazi/atomic-question-matrix.ts`
- Phase 1 acceptance proof: `docs/bazi-atomic-question-matrix-acceptance-v1.md`

## Inputs Used

- FAQ taxonomy source conventions from `FAQ by Mootech AI - Sheet1.csv`, normalized by `buildFaqTaxonomies()` in `src/lib/bazi/canonical-knowledge.ts`
- Current adapter bucket definitions in `src/features/open-webui/truth-packet.ts`
- Phase 1 plan and truth-packet roadmap snapshots dated 2026-06-04

## Canonical Bucket Rules

- Canonical bucket names stay neutral to any one UI shell.
- FAQ labels such as `Work`, `Love`, `Wealth`, `Study`, `Health`, and `Others` are source evidence, not final contract names.
- Current adapter aliases can map later, for example `career -> work` and `general_reading -> foundation`, but this inventory does not depend on those names.
- Multi-domain prompts should fan out into multiple atomic jobs instead of forcing one mixed subtype.

## Grouping Rules

- Group near-duplicate phrasings when the underlying sinsae job is the same.
- Keep timing questions separate from profile, fit, or outcome questions.
- Keep result questions separate from strategy or caution questions.
- Keep spouse profile separate from relationship timing.
- Keep wealth accumulation separate from wealth timing.
- Keep job-switch timing separate from career fit.

## Bucket Alias Draft

| Canonical bucket | Source evidence | Current adapter relation |
| --- | --- | --- |
| work | `Work`, some `Study` rows that are really role-fit or job-entry questions | later maps to `career` when needed |
| wealth | `Wealth`, plus some multi-domain rows | later maps to `wealth` |
| relationship | `Love`, plus some multi-domain rows | later maps to `love` |
| study | `Study` rows that are genuinely education-first | currently adjacent to work/general, not yet a dedicated adapter bucket |
| health | `Health` rows and health-caution composites | later maps to `health` |
| foundation | `Others`, broad life-direction prompts, and base-chart reading prompts | later maps to `general_reading` when needed |
| cross_domain | any prompt that must split into more than one atomic job | no direct adapter bucket |

## Draft Atomic Inventory

### Work

| Atomic job ID | Underlying sinsae job | Representative question shapes to merge | Keep separate from |
| --- | --- | --- | --- |
| work.career_fit | Identify suitable role, path, or work style | `เราถนัดด้านไหน`, `โตขึ้นจะได้ทำงานอะไร`, `ถ้าเลือกทำงานในสาขาวิเคราะห์ข้อมูลจะดีไหม`, `อาชีพไหนจะเหมาะกับตัวเอง` | `work.job_switch_timing`, `work.offer_result` |
| work.job_switch_timing | Decide when a work move should happen | `ปีนี้จะมีแนวโน้มเปลี่ยนงานไหม`, `ควรเปลี่ยนงานภายในเดือนไหน`, `การย้ายงาน`, `อีก 6-12 เดือนควรย้ายงานไหม` | `work.career_fit`, `work.offer_result` |
| work.offer_result | Ask whether a job, internship, casting, or interview result will land | `ฉันจะได้งานใหม่ไหม`, `จะได้งานบริษัทที่หวังไว้ไหม`, `จะได้ที่ฝึกงานไหม`, `ออดิชั่นจะผ่านไหม`, `จะมีที่อื่นติดต่อมาไหม` | `work.job_switch_timing`, `study.exam_result` |
| work.role_change_quality | Judge whether a new role or position is better than the current one | `งานใหม่จะดีกว่าหรือก้าวหน้ากว่างานเดิมไหม`, `งานตำแหน่งที่กำลังจะเปลี่ยนดีไหม` | `work.offer_result`, `work.career_fit` |
| work.venture_viability | Evaluate business or side-project viability | `อยากทำธุรกิจใหม่ควรไปต่อหรือไม่`, `เปิดธุรกิจขนส่งดีไหม`, `การเขียนนิยายจะรุ่งไหม`, `ทำติ๊กต๊อกจะเป็นประตูเปิดทางไหม` | `wealth.accumulation_capacity`, `work.project_risk` |
| work.project_risk | Identify work friction, project blockers, or authority pressure | `โปรเจคที่กำลังทำอยู่มีปัญหาไหม`, `มีบทความวิจัยต้องตีพิมพ์จะผ่านไหม`, `มีอะไรต้องระวังในงาน` | `work.offer_result`, `foundation.general_caution` |
| work.recognition_path | Ask whether a public-facing or status path is likely to open | `มีเกณฑ์ได้เป็นศิลปินตามฝันไหม`, `มีดวงทำอาชีพอินฟลูหรือดาราไหม`, `จะสอบติดครูราชการไหม` | `work.career_fit`, `work.offer_result` |

### Wealth

| Atomic job ID | Underlying sinsae job | Representative question shapes to merge | Keep separate from |
| --- | --- | --- | --- |
| wealth.accumulation_capacity | Judge ability to build and retain money over time | `การเงินจะดีขึ้นไหม`, `มีโอกาสจะรวยจับเงินสิบล้านไหม`, `ควรปรับอะไรเพื่อให้มีเก็บมาก` | `wealth.timing_window`, `wealth.windfall_luck` |
| wealth.timing_window | Ask when money movement, improvement, or target income will appear | `การเงินในเดือนกุมภาพันธ์`, `จะเริ่มเห็นผลเมื่ออายุเท่าไหร่`, `รายได้ 50,000 บาทต่อเดือนจะมาเมื่อไหร่` | `wealth.accumulation_capacity`, `work.job_switch_timing` |
| wealth.income_source_fit | Identify where the main money channel should come from | `มีรายได้หลักมาจากอะไร`, `หาเงินจากคอร์สออนไลน์ได้ไหม`, `ธุรกิจนี้จะทำเงินจากทางไหน` | `wealth.accumulation_capacity`, `work.career_fit` |
| wealth.windfall_luck | Ask about luck-driven gains instead of earned accumulation | `มีโชคลาภไหม`, `จะมีโชคลาภรางวัลใหญ่ไหม` | `wealth.accumulation_capacity`, `wealth.timing_window` |
| wealth.risk_investment | Evaluate business, investment, or money-risk exposure | `ลงทุนธุรกิจเล็กๆกับเพื่อนดีไหม`, `อยากทำธุรกิจกับแฟนได้ไหม`, `ลงทุนแล้วควรระวังอะไร` | `wealth.accumulation_capacity`, `relationship.partner_money_dynamic` |
| wealth.partner_money_dynamic | Assess how relationship dynamics affect money decisions | `ทำธุรกิจกับแฟนได้ไหม`, `เงินจะดีขึ้นไหมถ้าไปต่อกับคู่/หุ้นส่วนนี้` | `relationship.relationship_viability`, `wealth.risk_investment` |

### Relationship

| Atomic job ID | Underlying sinsae job | Representative question shapes to merge | Keep separate from |
| --- | --- | --- | --- |
| relationship.partner_profile | Describe the likely partner or relationship type | `เมื่อไหร่จะมีแฟน แล้วแฟนนิสัยหน้าตาเป็นยังไง`, `แฟนในอนาคตจะเป็นแบบไหน`, `เราจะเจอคนแบบไหน` | `relationship.timing_window`, `relationship.current_person_feelings` |
| relationship.timing_window | Ask when a relationship, marriage, or new person enters | `เมื่อไหร่จะเจอเนื้อคู่`, `จะมีแฟนภายใน 3 เดือนนี้ไหม`, `ปีนี้จะมีแฟนไหม`, `จะมีความรักเข้ามาเมื่อไหร่` | `relationship.partner_profile`, `relationship.reconciliation` |
| relationship.current_person_feelings | Ask what a specific person feels now | `เขารู้สึกยังไงกับเรา`, `คนที่เราคิดถึงมีความรู้สึกให้เราหรือเราคิดไปเอง`, `เขารักหนูไหม` | `relationship.partner_profile`, `relationship.relationship_viability` |
| relationship.reconciliation | Ask whether an ex or previous connection returns | `แฟนเก่าจะกลับมามั้ย`, `คนเก่าที่เลิกคุยไปมีโอกาสกลับมาหาไหม`, `จะได้กลับไปคุยกับโอ๊คไหม` | `relationship.timing_window`, `relationship.current_person_feelings` |
| relationship.relationship_viability | Judge whether a bond should continue or will go further | `ความรักจะมีโอกาสได้ไปต่อไหม`, `จากเพื่อนกลายเป็นคนรักจะผิดหวังไหม`, `ความรักช่วงนี้จะเป็นยังไง` | `relationship.current_person_feelings`, `relationship.reconciliation` |
| relationship.third_party_risk | Check infidelity, triangles, or extra-person interference | `มันนอกใจไหม`, `แฟนจะมีใครไหม`, `จะมีผู้ชายเข้ามาสนใจอีกไหม` | `relationship.current_person_feelings`, `relationship.relationship_viability` |
| relationship.marriage_readiness | Ask whether the chart is ready for serious commitment or marriage | `พร้อมแต่งงานไหม`, `ช่วงนี้เหมาะกับการเริ่มจริงจังไหม`, roadmap example `marriage readiness` | `relationship.timing_window`, `relationship.partner_profile` |

### Study

| Atomic job ID | Underlying sinsae job | Representative question shapes to merge | Keep separate from |
| --- | --- | --- | --- |
| study.exam_result | Ask whether an exam, admissions, or scholarship result will succeed | `จะสอบติดสัตวแพทย์ปีนี้ไหม`, `ปีนี้จะติดแพทย์ไหม`, `จะได้ทุนไหม`, `จะสอบได้ไหม` | `study.study_fit`, `work.offer_result` |
| study.study_fit | Identify the right field, degree, or direction of study | `อยากรู้ว่าเรื่องเรียนจะเป็นยังไง`, `ลังเลว่าจะเข้าคณะอะไรดี`, `มาถูกทางแล้วใช่ไหมเรื่องที่เรียน` | `study.exam_result`, `work.career_fit` |
| study.academic_risk | Check grade risk, retention risk, or study obstacles | `เสี่ยงโดนรีไทล์ไหม`, `ผลสอบจะดีไหม`, `การเรียนช่วงนี้จะเป็นไงบ้าง` | `study.exam_result`, `foundation.general_caution` |
| study.mobility_timing | Ask about relocation or timing linked to study | `จะมีโอกาสไปอยู่ไกลบ้านไหม`, `สอบผ่านช่วงไหน`, `ดวงดีช่วงอายุไหน` | `study.study_fit`, `relationship.timing_window` |

### Health

| Atomic job ID | Underlying sinsae job | Representative question shapes to merge | Keep separate from |
| --- | --- | --- | --- |
| health.constitution_baseline | Describe core body balance or baseline weakness | roadmap example `baseline constitution`, health-first prompts about body tendency | `health.timing_sensitive_weakness`, `health.recovery_caution` |
| health.timing_sensitive_weakness | Ask when a body weakness or caution period is activated | roadmap example `timing-sensitive weakness`, prompts asking what to watch now | `health.constitution_baseline`, `relationship.timing_window` |
| health.recovery_caution | Ask whether a recovery, body-goal, or health plan is safe to pursue | `ลดน้ำหนักจะได้ตามหวังไหม`, `มีอะไรต้องระวังไว้ไหม`, roadmap example `recovery caution` | `health.constitution_baseline`, `foundation.general_caution` |

### Foundation

| Atomic job ID | Underlying sinsae job | Representative question shapes to merge | Keep separate from |
| --- | --- | --- | --- |
| foundation.base_chart_persona | Read the chart's core temperament and structural baseline | roadmap example `personality core`, `chart structure`, broad prompts that ask who this person is at the base layer | `work.career_fit`, `relationship.partner_profile` |
| foundation.life_direction_check | Ask whether the current path is broadly right | `ที่ทำอยู่ตอนนี้มันถูกต้องไหม`, `ชีวิตหลังจากนี้จะเป็นขาขึ้นไหม`, `สิ่งที่จะทำไปนี้จะได้ผลตามที่หวังไหม` | `work.project_risk`, `study.study_fit` |
| foundation.general_timing_focus | Ask for broad year or decade focus without one narrow domain | roadmap example `yearly focus`, `decade focus`, `ดวงดีช่วงอายุไหน` when not clearly study-only | `wealth.timing_window`, `relationship.timing_window` |
| foundation.general_caution | Ask what should be watched overall, without one main domain | `อะไรคือสิ่งที่ต้องระวัง`, `ช่วงนี้วิธีแก้ปัญหาแบบไหนดีสุด` | domain-specific caution jobs |

### Cross-domain decomposition rules

These prompt shapes should split into multiple atomic jobs instead of becoming one new subtype.

| Prompt pattern | Decompose into |
| --- | --- |
| `การเงิน + งาน` | one wealth job plus one work job |
| `ความรัก + เวลา` | one relationship timing job and, only if asked, one partner profile job |
| `งาน + เรียน` | keep exam or study result separate from work-entry result |
| `รัก + เงิน + งาน` | split by domain first, then by job type inside each domain |
| `อยากมีลูก + เรื่องงาน` | family/child question must stay separate from work question |

## Review Notes For Phase 1A

- `wealth.accumulation_capacity` and `wealth.timing_window` are intentionally separate.
- `work.job_switch_timing` and `work.career_fit` are intentionally separate.
- `relationship.partner_profile` and `relationship.timing_window` are intentionally separate.
- The inventory is reusable for Open WebUI and future custom UI because it freezes canonical jobs and bucket names before adapter mapping.
- Phase 1B doctrine cards begin below and stay adapter-neutral by naming evidence surfaces rather than shell-specific UI text.

## Phase 1B Doctrine Cards

These cards are review-first and adapter-neutral.
Evidence names below refer to current truth-packet or calculated-state surfaces, not to any one UI shell.

### Support Status Scale

- `supported`: current engine truth exposes a safe primary evidence set for this job.
- `partial`: some required truth exists, but the later composer must narrow scope or add stronger guardrails before making strong claims.
- `insufficient`: current engine truth does not expose a safe dedicated evidence set for this job yet.

### Work Doctrine Cards

#### `work.career_fit`

- User ask: Which role, path, or work style fits me best?
- Must answer: Name the fit pattern, explain why it fits, and say what kind of work context amplifies or drains it.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `careerTenGodHighlights`, `elementAnalysis`; use `workCompatibilityProfile` only when a concrete role or team comparison exists.
- Forbidden noise: exact switch timing, romance commentary, and wealth promises that are not grounded in work evidence.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> careerTenGodHighlights -> elementAnalysis -> workCompatibilityProfile if present -> timing only if the user also asks when`.
- Support status: `supported`.

#### `work.job_switch_timing`

- User ask: Should I change jobs, and when is the safer window?
- Must answer: State whether a move window is opening, what kind of move it favors, and what caution condition would make the move premature.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `careerTenGodHighlights`, `currentDaYun`, `activeTimingWindow`, `nextTimingWindows`, `liuNian` when available.
- Forbidden noise: naming a specific employer, promising an offer, or drifting into romance and lifestyle commentary.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> careerTenGodHighlights -> currentDaYun -> activeTimingWindow -> nextTimingWindows -> liuNian`.
- Support status: `partial`. Current truth exposes timing context, but it does not yet have a dedicated move-readiness layer for switch risk versus fit.

#### `work.offer_result`

- User ask: Will I get this job, internship, casting, or interview result?
- Must answer: Give a cautious probability read on outcome direction, plus the strongest reason for support or drag from the chart.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `careerTenGodHighlights`, `activeTimingWindow`, `nextTimingWindows`, `liuNian` when available.
- Forbidden noise: absolute guarantees, invented recruiter intent, and unrelated romance or family narrative.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> careerTenGodHighlights -> activeTimingWindow -> nextTimingWindows -> liuNian`.
- Support status: `partial`. The current engine can show work pressure and timing windows, but it does not have an event-outcome resolver for one specific offer result.

#### `work.role_change_quality`

- User ask: Is the new role or position better than the current one?
- Must answer: Compare direction of gain versus drag, and say what dimension improves most: growth, stability, authority, or strain.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `careerTenGodHighlights`, `elementAnalysis`, `workCompatibilityProfile` if a concrete comparison target exists, plus timing sections when the change is imminent.
- Forbidden noise: treating every move as automatically better, promising salary outcomes without wealth evidence, and drifting into relationship advice.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> careerTenGodHighlights -> elementAnalysis -> workCompatibilityProfile if present -> activeTimingWindow when the move is near-term`.
- Support status: `partial`. Current truth can frame work suitability, but it lacks a dedicated compare-old-vs-new role contract.

#### `work.venture_viability`

- User ask: Should I pursue this business, side project, or public-facing venture?
- Must answer: State whether the venture direction is structurally aligned, what operating style it needs, and where the main fragility sits.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `careerTenGodHighlights`, `elementAnalysis`, `financeTenGodHighlights` when wealth risk is central, plus timing sections for launch windows.
- Forbidden noise: lottery-style money promises, romance narrative, and pretending a side project equals guaranteed fame.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> careerTenGodHighlights -> elementAnalysis -> financeTenGodHighlights if money risk is part of the ask -> activeTimingWindow -> nextTimingWindows`.
- Support status: `partial`. The engine exposes work and wealth anchors, but it does not yet have a dedicated venture viability matrix.

#### `work.project_risk`

- User ask: What friction, blocker, or pressure should I watch in this work or project?
- Must answer: Name the likely friction type, where it comes from, and what kind of caution matters most now.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `careerTenGodHighlights`, `elementAnalysis`, `activeTimingWindow`, `liuNian` when available.
- Forbidden noise: generic fear language, diagnosis-style claims, and unrelated love or wealth storytelling.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> careerTenGodHighlights -> elementAnalysis -> activeTimingWindow -> liuNian`.
- Support status: `partial`. The current truth can surface work pressure, but it does not yet expose project-specific blocker classifications.

#### `work.recognition_path`

- User ask: Does this chart support public recognition, status, or a visible title path?
- Must answer: Say whether visibility or status is plausible, what form it is more likely to take, and what condition makes it sustainable.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `careerTenGodHighlights`, `elementAnalysis`, `activeTimingWindow`, `nextTimingWindows`.
- Forbidden noise: celebrity promises, exam-result certainty without separate proof, and drifting into romance or wealth hype.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> careerTenGodHighlights -> elementAnalysis -> activeTimingWindow -> nextTimingWindows`.
- Support status: `partial`. The engine has general career anchors, but no dedicated public-recognition or status-path truth layer.

### Wealth Doctrine Cards

#### `wealth.accumulation_capacity`

- User ask: Can I build and keep money well over time?
- Must answer: State the chart's money-building capacity, how stable it is, and what pattern helps retention rather than leakage.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `elementAnalysis`, `financeTenGodHighlights`.
- Forbidden noise: exact timing promises, lottery-style fortune claims, and work or romance narrative that is not needed for the money question.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> elementAnalysis -> financeTenGodHighlights`.
- Support status: `supported`.

#### `wealth.timing_window`

- User ask: When is money likely to improve or move more clearly?
- Must answer: Identify the relevant money window, what kind of money movement it favors, and what caution keeps the timing answer honest.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `financeTenGodHighlights`, `currentDaYun`, `activeTimingWindow`, `nextTimingWindows`, `liuNian` when available.
- Forbidden noise: guaranteed income numbers, unrelated romance commentary, and vague "soon" language with no timing anchor.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> financeTenGodHighlights -> currentDaYun -> activeTimingWindow -> nextTimingWindows -> liuNian`.
- Support status: `supported`.

#### `wealth.income_source_fit`

- User ask: What money channel or earning route fits me best?
- Must answer: Point to the most natural earning mode, explain why it fits, and say what kind of route should stay secondary.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `financeTenGodHighlights`, `elementAnalysis`, `careerTenGodHighlights` when the income route depends on work style.
- Forbidden noise: one-channel absolutism, switch timing advice without being asked, and relationship commentary unless the ask is explicitly partner-linked.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> financeTenGodHighlights -> elementAnalysis -> careerTenGodHighlights if route and role are intertwined`.
- Support status: `partial`. The engine has money anchors, but it does not yet expose a dedicated income-channel resolver.

#### `wealth.windfall_luck`

- User ask: Is there luck-driven money or a sudden gain pattern here?
- Must answer: Only answer whether the chart safely supports speaking about windfall tendency at all, and keep the answer narrower than a guarantee.
- Mandatory evidence: `chartIdentity`, `financeTenGodHighlights`, timing sections if a window is asked explicitly.
- Forbidden noise: jackpot promises, invented omen language, and confusing earned accumulation with luck-based gain.
- Reading order: `chartIdentity -> financeTenGodHighlights -> activeTimingWindow if the user asks when`.
- Support status: `insufficient`. Current engine truth does not expose a dedicated luck-or-windfall surface, so this job needs a future support contract or a stricter fallback.

#### `wealth.risk_investment`

- User ask: Is this investment, business, or money-risk move safe enough to pursue?
- Must answer: State whether the chart supports taking risk now, what kind of risk is most exposed, and what boundary should not be crossed.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `financeTenGodHighlights`, `elementAnalysis`, `activeTimingWindow`, `nextTimingWindows`; add work anchors when the risk is tied to a venture.
- Forbidden noise: moral judgment, guaranteed profit, and partner commentary unless the ask is explicitly joint.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> financeTenGodHighlights -> elementAnalysis -> activeTimingWindow -> nextTimingWindows -> work anchors only if the investment is operational`.
- Support status: `partial`. The engine can frame money pressure and timing, but it lacks an investment-specific risk vocabulary.

#### `wealth.partner_money_dynamic`

- User ask: How does this partner or relationship dynamic affect money decisions?
- Must answer: Only speak to the money-pattern interaction if the chart truth can separate it from general romance narrative.
- Mandatory evidence: `financeTenGodHighlights`, `relationshipTenGodHighlights`, `loveCompatibilityProfile` when a counterpart is actually present, plus timing sections if the decision is near-term.
- Forbidden noise: blanket judgments about the partner, marriage advice not asked for, and generic wealth promises.
- Reading order: `chartIdentity -> financeTenGodHighlights -> relationshipTenGodHighlights -> loveCompatibilityProfile if present -> activeTimingWindow when timing matters`.
- Support status: `insufficient`. Current engine truth does not yet expose a safe cross-domain wealth-plus-relationship contract by default.

### Relationship Doctrine Cards

#### `relationship.partner_profile`

- User ask: What kind of partner or relationship type is likely for me?
- Must answer: Describe the partner pattern, the relational tone, and what kind of person or bond shape is more natural than forced.
- Mandatory evidence: `chartIdentity`, `spousePalace`, `relationshipTenGodHighlights`, `dayMasterStrengthProfile`; use `loveCompatibilityProfile` only for a concrete counterpart comparison.
- Forbidden noise: timing guesses, mind-reading a specific person, and mixing in work or money commentary without need.
- Reading order: `chartIdentity -> spousePalace -> relationshipTenGodHighlights -> dayMasterStrengthProfile -> loveCompatibilityProfile if present`.
- Support status: `supported`.

#### `relationship.timing_window`

- User ask: When is a relationship, marriage, or new person likely to enter?
- Must answer: Identify the relationship window, the kind of opening it suggests, and what makes the window stronger or weaker.
- Mandatory evidence: `chartIdentity`, `spousePalace`, `relationshipTenGodHighlights`, `currentDaYun`, `activeTimingWindow`, `nextTimingWindows`, `liuNian` when available.
- Forbidden noise: facial or personality profile detail when the question is only timing, and certainty about one named person.
- Reading order: `chartIdentity -> spousePalace -> relationshipTenGodHighlights -> currentDaYun -> activeTimingWindow -> nextTimingWindows -> liuNian`.
- Support status: `supported`.

#### `relationship.current_person_feelings`

- User ask: What does this specific person feel right now?
- Must answer: Only answer to the extent the chart supports discussing relational tendency or compatibility; do not present the other person's inner state as known fact.
- Mandatory evidence: `loveCompatibilityProfile` if a real counterpart profile exists; otherwise only broad self-chart relationship tendency can be used.
- Forbidden noise: mind-reading certainty, invented messages from the other person, and treating natal chart signals as real-time emotional surveillance.
- Reading order: `loveCompatibilityProfile if present -> self-chart relationship anchors only as background`.
- Support status: `insufficient`. Current engine truth is chart-first, not a direct read of one specific person's current feelings.

#### `relationship.reconciliation`

- User ask: Is there a real chance an ex or past connection returns?
- Must answer: Distinguish between a general reopening window and a claim about one specific person coming back.
- Mandatory evidence: `chartIdentity`, `spousePalace`, `relationshipTenGodHighlights`, `activeTimingWindow`, `nextTimingWindows`, `liuNian`; use `loveCompatibilityProfile` only when a true counterpart comparison exists.
- Forbidden noise: certainty that the ex is thinking about the user, revenge narrative, and blanket soulmate claims.
- Reading order: `chartIdentity -> spousePalace -> relationshipTenGodHighlights -> activeTimingWindow -> nextTimingWindows -> liuNian -> loveCompatibilityProfile if present`.
- Support status: `partial`. The engine can support timing and relationship reopening tendency, but not a hard claim about one ex's current intention.

#### `relationship.relationship_viability`

- User ask: Should this bond continue, and does it have room to go further?
- Must answer: Say whether the bond has structural support, what the main strain is, and what condition determines whether it can stabilize.
- Mandatory evidence: `chartIdentity`, `spousePalace`, `relationshipTenGodHighlights`, `dayMasterStrengthProfile`, `loveCompatibilityProfile` if a counterpart exists, plus timing sections when the decision is immediate.
- Forbidden noise: marriage timing if it was not asked, work commentary, and certainty about the other person's motives.
- Reading order: `chartIdentity -> spousePalace -> relationshipTenGodHighlights -> dayMasterStrengthProfile -> loveCompatibilityProfile if present -> timing only when the user asks should/now`.
- Support status: `partial`. The engine can speak to relational fit and strain, but the answer is stronger when a counterpart profile exists.

#### `relationship.third_party_risk`

- User ask: Is there third-party interference, infidelity risk, or triangle pressure here?
- Must answer: Only answer if the chart exposes a safe interference pattern; otherwise fall back to uncertainty plainly.
- Mandatory evidence: `relationshipTenGodHighlights`, `loveCompatibilityProfile` if counterpart data exists, timing sections for near-term caution.
- Forbidden noise: accusation language, certainty of cheating, and surveillance-style claims about unnamed third parties.
- Reading order: `relationshipTenGodHighlights -> loveCompatibilityProfile if present -> activeTimingWindow when caution is time-bound`.
- Support status: `insufficient`. Current engine truth does not expose a dedicated third-party or infidelity-risk surface.

#### `relationship.marriage_readiness`

- User ask: Is this chart ready for serious commitment or marriage?
- Must answer: State whether commitment readiness is structurally present, what kind of partnership maturity is visible, and which timing window matters most.
- Mandatory evidence: `chartIdentity`, `spousePalace`, `relationshipTenGodHighlights`, `dayMasterStrengthProfile`, `currentDaYun`, `activeTimingWindow`, `nextTimingWindows`.
- Forbidden noise: naming a spouse profile when the ask is readiness only, and certainty about a wedding date.
- Reading order: `chartIdentity -> spousePalace -> relationshipTenGodHighlights -> dayMasterStrengthProfile -> currentDaYun -> activeTimingWindow -> nextTimingWindows`.
- Support status: `supported`.

### Study Doctrine Cards

#### `study.exam_result`

- User ask: Will I pass this exam, get admitted, or receive this scholarship?
- Must answer: Give a cautious outcome-direction read, plus the strongest support and drag factors without pretending certainty.
- Mandatory evidence: `dayMasterStrengthProfile`, `elementAnalysis`, `currentDaYun`, `activeTimingWindow`, `nextTimingWindows`, `liuNian`; borrow `careerTenGodHighlights` only when the exam is directly tied to role-entry.
- Forbidden noise: ranking guarantees, employer-like work commentary, and generic destiny language.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> elementAnalysis -> currentDaYun -> activeTimingWindow -> nextTimingWindows -> liuNian -> careerTenGodHighlights only if role-entry is the real job`.
- Support status: `partial`. Current engine truth can support timing and pressure reading, but there is no dedicated study intent or exam-outcome contract yet.

#### `study.study_fit`

- User ask: Which field, degree, or learning direction fits me best?
- Must answer: Name the study direction pattern, why it fits, and what style of learning or discipline suits the chart.
- Mandatory evidence: `dayMasterStrengthProfile`, `elementAnalysis`, `sixtyJiaziCorePersona` when helpful, and `careerTenGodHighlights` only when study and future role are tightly linked.
- Forbidden noise: immediate job-switch advice, romance narrative, and exam timing unless the user asks it.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> sixtyJiaziCorePersona if present -> elementAnalysis -> careerTenGodHighlights only when study is role-bound`.
- Support status: `partial`. The answer can be approximated from general and work truth, but there is no dedicated study-fit surface.

#### `study.academic_risk`

- User ask: What academic obstacle, retention risk, or grade pressure should I watch?
- Must answer: Name the main study-side friction and describe whether it is a timing spike, discipline issue, or baseline mismatch.
- Mandatory evidence: `dayMasterStrengthProfile`, `elementAnalysis`, `activeTimingWindow`, `nextTimingWindows`, `liuNian`; use `general_caution` style reasoning only if it stays study-bound.
- Forbidden noise: medical framing, romance commentary, and job-offer prediction.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> elementAnalysis -> activeTimingWindow -> nextTimingWindows -> liuNian`.
- Support status: `partial`. Current engine truth can surface caution and timing pressure, but not a study-specific academic-risk classifier.

#### `study.mobility_timing`

- User ask: When is movement, relocation, or a study-linked transition likely to happen?
- Must answer: Identify the timing window and say whether the movement is supportive or disruptive for study goals.
- Mandatory evidence: `dayMasterStrengthProfile`, `currentDaYun`, `activeTimingWindow`, `nextTimingWindows`, `liuNian`, plus general foundation evidence if the move is not strictly study-only.
- Forbidden noise: relationship timing, career switching, and certainty about a specific institution or city.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> currentDaYun -> activeTimingWindow -> nextTimingWindows -> liuNian -> foundation evidence only if the ask is broad life movement`.
- Support status: `partial`. The engine has timing truth, but not a dedicated study-mobility support surface.

### Health Doctrine Cards

#### `health.constitution_baseline`

- User ask: What is the chart's baseline body tendency or core weakness?
- Must answer: Describe the baseline constitution pattern, what part of balance looks thin or overloaded, and what kind of caution frame is appropriate.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `elementAnalysis`, `seasonalInteraction`.
- Forbidden noise: diagnosis, treatment instructions, and certainty about disease.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> elementAnalysis -> seasonalInteraction`.
- Support status: `supported`.

#### `health.timing_sensitive_weakness`

- User ask: When is a body weakness or caution period more activated?
- Must answer: Identify the vulnerable timing window, what kind of strain becomes more relevant there, and keep the answer at caution level.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `elementAnalysis`, `seasonalInteraction`, `currentDaYun`, `activeTimingWindow`, `nextTimingWindows`, `liuNian` when available.
- Forbidden noise: diagnosis, emergency claims, and non-health domain commentary.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> elementAnalysis -> seasonalInteraction -> currentDaYun -> activeTimingWindow -> nextTimingWindows -> liuNian`.
- Support status: `partial`. The engine exposes health baseline plus generic timing, but it does not yet have a dedicated health-temporal overlay.

#### `health.recovery_caution`

- User ask: Is this recovery plan, body goal, or health effort safe to pursue now?
- Must answer: State whether the chart supports cautious pursuit, what kind of strain to watch, and where the answer must stop short of treatment advice.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `elementAnalysis`, `seasonalInteraction`, timing sections when the plan is near-term.
- Forbidden noise: medical treatment instructions, certainty about outcomes, and unrelated work or relationship content.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> elementAnalysis -> seasonalInteraction -> activeTimingWindow if the user asks now/soon`.
- Support status: `partial`. Current truth can support caution framing, but not medical-outcome certainty.

### Foundation Doctrine Cards

#### `foundation.base_chart_persona`

- User ask: Who is this person at the base-chart level?
- Must answer: Describe core temperament, structural baseline, and the main pattern that other domains should inherit from.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `sixtyJiaziCorePersona`, `elementAnalysis`, `seasonalInteraction`, `readingOrderSteps` when available.
- Forbidden noise: domain-specific forecasting, romance profile detail, and timing claims unless the user explicitly shifts into a timing question.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> sixtyJiaziCorePersona -> elementAnalysis -> seasonalInteraction -> readingOrderSteps`.
- Support status: `supported`.

#### `foundation.life_direction_check`

- User ask: Is the path I am on broadly aligned or off-track?
- Must answer: State whether the direction is broadly aligned, what makes it aligned or strained, and which adjustment matters more than brute force.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `sixtyJiaziCorePersona`, `elementAnalysis`, `seasonalInteraction`, timing sections when the question is about the current season of life.
- Forbidden noise: substituting a narrow work or love answer for a broad path question, and certainty about one future event.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> sixtyJiaziCorePersona -> elementAnalysis -> seasonalInteraction -> activeTimingWindow if the user asks about the current phase`.
- Support status: `supported`.

#### `foundation.general_timing_focus`

- User ask: What broad life phase or timing focus matters most right now?
- Must answer: Identify the main active period, what it emphasizes, and what should remain background rather than foreground.
- Mandatory evidence: `chartIdentity`, `currentDaYun`, `activeTimingWindow`, `nextTimingWindows`, `liuNian` when available, plus base foundation anchors for interpretation.
- Forbidden noise: domain-specific money or romance detail unless the user asks for that split explicitly.
- Reading order: `chartIdentity -> currentDaYun -> activeTimingWindow -> nextTimingWindows -> liuNian -> foundation anchors for interpretation`.
- Support status: `supported`.

#### `foundation.general_caution`

- User ask: What should I watch overall when there is no single main domain?
- Must answer: Name the top caution theme, explain why it matters now, and keep the answer broad rather than sneaking in a domain-specific forecast.
- Mandatory evidence: `chartIdentity`, `dayMasterStrengthProfile`, `elementAnalysis`, `seasonalInteraction`, `activeTimingWindow`, `liuNian` when available.
- Forbidden noise: diagnosis, relationship accusation, investment advice, and any narrow domain forecast that has not been requested.
- Reading order: `chartIdentity -> dayMasterStrengthProfile -> elementAnalysis -> seasonalInteraction -> activeTimingWindow -> liuNian`.
- Support status: `supported`.

## Phase 1C Storage Contract

- Canonical home: `src/lib/bazi/atomic-question-matrix.ts`.
- Canonical machine shape: exported `BAZI_ATOMIC_QUESTION_MATRIX` object with `version`, `canonicalHome`, `reviewDocumentPath`, `taxonomySource`, `crossDomainDecomposition`, and typed `entries`.
- Human review mirror: this markdown document remains the readable review artifact for Phase 1, but it is no longer the primary machine-consumable contract.
- FAQ taxonomy relation: `bazi_faq_taxonomies` remains the upstream phrase inventory and coarse domain evidence. The matrix binds back through `faqTaxonomy.primaryIntents` and optional `faqTaxonomy.rawTypeLabels`, so one taxonomy lane can narrow into one or more atomic jobs without overwriting the source taxonomy.
- Why this home: repo memory is historical evidence, not an executable contract; markdown docs are review-friendly but force later phases to parse prose; a focused code-adjacent contract keeps the matrix importable without widening the already-large `schema-types.ts` surface.
- Adapter neutrality: canonical bucket names and job IDs stay shell-neutral here. Any adapter aliases, including Open WebUI bucket naming, belong in adapter code rather than in this matrix.