/**
 * โหมดจับคู่สมพงษ์ (Tinder-style).
 *
 * GET /api/bazi/matchmaker
 *   → { people: PersonCard[] }  — โรสเตอร์ทั้งหมด (ดวงที่ผูกไว้ใน DB + ดวงตัวอย่าง)
 *     สำหรับเลือก "ตัวเรา".
 *
 * GET /api/bazi/matchmaker?selfId=<id>&gender=<male|female|all>&relationship=<love|partner|boss|subordinate>
 *   → { self, deck: DeckCard[], relationship, matchThreshold }
 *     — เด็คผู้สมัคร (ยกเว้นตัวเอง กรองตามเพศ) พร้อมผลสมพงษ์เทียบกับตัวเรา
 *       เรียงเกรดดี→น้อย. คำนวณ deterministically ด้วย pair engine (ไม่ใช้ LLM).
 *
 * ถ้า DB ล่ม/ว่าง จะ fallback ใช้ SAMPLE_PEOPLE เพื่อให้เด็คยังใช้งานได้.
 */
import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildFacets, mainFacetOf, RELATIONSHIP_SPECS } from "@/lib/bazi/pair-matching";
import { applyMatchingOverrides, type MatchingText } from "@/lib/bazi/matching-overlay";
import { getMatchingMap } from "@/lib/bazi/matching.server";
import { createDbSavedChartRepository } from "@/lib/bazi/saved-chart-repository";
import { SAMPLE_PEOPLE, type SamplePerson } from "@/lib/bazi/matchmaker-people";
import {
  ageFromBirthDate,
  birthLabelTh,
  MATCH_THRESHOLD,
  toneOfPercent,
  verdictOfPercent,
  type DeckCard,
  type FacetBar,
  type GenderFilter,
  type PersonCard,
} from "@/lib/bazi/matchmaker";
import type { PillarPos, DayPillar, RelationshipType } from "@/lib/bazi/pair-types";
import type { RawInputValue } from "@/lib/bazi/schema-types";
import { ELEMENT_LABELS_TH, STEM_TO_ELEMENT } from "@/lib/bazi/symbolic-engine.constants";
import { resolveDisplayTwelveQiStage } from "@/lib/bazi/pillar-display";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

export const runtime = "nodejs";

type BaziState = Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>;

/** คน 1 คนพร้อม rawInput ที่พร้อมคำนวณ (รวมทั้งดวง DB + ตัวอย่าง). */
type Candidate = {
  id: string;
  name: string;
  gender: string;
  source: "saved" | "sample";
  rawInput: RawInputValue;
  bio?: string;
  tags?: string[];
};

function sampleToCandidate(p: SamplePerson): Candidate {
  return {
    id: `sample:${p.key}`,
    name: p.name,
    gender: p.gender,
    source: "sample",
    rawInput: p.rawInput,
    bio: p.bio,
    tags: p.tags,
  };
}

/**
 * โรสเตอร์ = ดวงที่ผูกไว้ใน DB (ถ้ามี). ถ้า DB ว่าง/ล่ม จึง fallback ใช้ดวงตัวอย่าง
 * เพื่อกันเด็คว่าง (ไม่ผสมกัน เพื่อกันชื่อซ้ำเมื่อ seed ตัวอย่างเข้า DB แล้ว).
 * `usingSamples` = กำลังโชว์ดวงตัวอย่าง (DB ว่างหรือล่ม).
 */
async function loadCandidates(): Promise<{ candidates: Candidate[]; usingSamples: boolean }> {
  let saved: Candidate[] = [];
  try {
    const rows = await createDbSavedChartRepository().listFull();
    saved = rows
      .filter((r) => r.rawInput?.birthDate && r.rawInput?.birthTime)
      .map((r) => ({
        id: r.id,
        name: r.label,
        gender: r.rawInput.gender ?? "",
        source: "saved" as const,
        rawInput: r.rawInput,
      }));
  } catch {
    // DB ล่ม → ใช้ตัวอย่าง
  }
  if (saved.length === 0) {
    return { candidates: SAMPLE_PEOPLE.map(sampleToCandidate), usingSamples: true };
  }
  return { candidates: saved, usingSamples: false };
}

function fourPillars(state: BaziState): Record<PillarPos, DayPillar> {
  const p = state.fourPillars;
  const lite = (x: { stem: string; branch: string }): DayPillar => ({ stem: x.stem, branch: x.branch });
  return { hour: lite(p.hour), day: lite(p.day), month: lite(p.month), year: lite(p.year) };
}

/** ธาตุของดิถี (ไทย) จากก้านวัน — วิธีเดียวกับ pair engine (buildPersonProfile). */
function dayElementTh(stem: string): string | null {
  const el = (STEM_TO_ELEMENT as Record<string, keyof typeof ELEMENT_LABELS_TH>)[stem];
  return el ? ELEMENT_LABELS_TH[el] : null;
}

/** ข้อมูลโปรไฟล์ย่อของคน (ไม่รวมผลเทียบ). */
function personCardOf(cand: Candidate, state: BaziState | null, now: Date): PersonCard {
  const day = state?.fourPillars.day;
  return {
    id: cand.id,
    name: cand.name,
    gender: cand.gender,
    source: cand.source,
    dayPillar: day ? `${day.stem}${day.branch}` : null,
    elementTh: day ? dayElementTh(day.stem) : null,
    stageTh: day ? resolveDisplayTwelveQiStage(day.stem, day.branch) : "",
    age: ageFromBirthDate(cand.rawInput.birthDate, now),
    birthLabel: birthLabelTh(cand.rawInput.birthDate),
    bio: cand.bio,
    tags: cand.tags,
  };
}

function matchesGender(gender: string, filter: GenderFilter): boolean {
  if (filter === "all") return true;
  const g = gender.trim().toLowerCase();
  if (filter === "male") return g === "male" || g === "ชาย";
  return g === "female" || g === "หญิง";
}

/** เทียบตัวเรา (self) กับผู้สมัคร 1 คน → DeckCard. */
function buildDeckCard(
  selfPillars: Record<PillarPos, DayPillar>,
  cand: Candidate,
  candState: BaziState,
  relationship: RelationshipType,
  text: MatchingText,
  now: Date,
): DeckCard {
  const candPillars = fourPillars(candState);
  const facets = buildFacets(relationship, selfPillars, candPillars, text);
  const main = mainFacetOf(facets);
  const percent = main?.percent ?? null;

  const facetBars: FacetBar[] = facets.map((f) => ({
    key: f.key,
    label: f.label,
    pairingLabel: f.pairingLabel,
    percent: f.percent,
    grade: f.grade,
    emoji: f.emoji,
    found: f.found,
    isMain: f.isMain,
  }));

  // นิสัยหลักวันของผู้สมัคร (ก้าน/ราศี/เชี่ยงแซ) จาก matching reference.
  const stem = candPillars.day.stem;
  const branch = candPillars.day.branch;
  const nisai: string[] = [];
  const byStem = text.reference.nisai.byStem[stem];
  const byBranch = text.reference.nisai.byBranch[branch];
  if (byStem) nisai.push(byStem);
  if (byBranch) nisai.push(byBranch);

  return {
    person: personCardOf(cand, candState, now),
    nisai,
    headline: {
      facetKey: main?.key ?? "",
      label: main?.label ?? "สมพงษ์",
      pairingLabel: main?.pairingLabel ?? "",
      percent,
      grade: main?.grade ?? "-",
      emoji: main?.emoji ?? null,
      verdict: verdictOfPercent(percent),
      ratingText: main?.ratingText ?? "",
      tone: toneOfPercent(percent),
    },
    facets: facetBars,
    elementSummary: "",
    sising: main?.sising
      ? { nameTh: main.sising.nameTh, nameCn: main.sising.nameCn, short: main.sising.short }
      : null,
    likesBack: percent != null && percent >= MATCH_THRESHOLD,
  };
}

function parseRelationship(value: unknown): RelationshipType {
  return typeof value === "string" && value in RELATIONSHIP_SPECS
    ? (value as RelationshipType)
    : "love";
}

function parseGender(value: unknown): GenderFilter {
  return value === "male" || value === "female" ? value : "all";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const selfId = url.searchParams.get("selfId")?.trim() || null;
  const now = new Date();

  const { candidates, usingSamples } = await loadCandidates();
  const repository = createDbKnowledgeRepository();

  // ── โหมดโรสเตอร์: ไม่มี selfId → คืนรายชื่อทั้งหมดพร้อมหลักวัน/อายุ ──
  if (!selfId) {
    const people = await Promise.all(
      candidates.map(async (c) => {
        try {
          const state = await calculateBaziStateFromRawInput(c.rawInput, { repository });
          return personCardOf(c, state, now);
        } catch {
          return personCardOf(c, null, now);
        }
      }),
    );
    return Response.json({ people, usingSamples });
  }

  // ── โหมดเด็ค: มี selfId → เทียบสมพงษ์กับทุกคน ──
  const self = candidates.find((c) => c.id === selfId);
  if (!self) {
    return Response.json({ error: "ไม่พบดวงตัวเราตาม selfId" }, { status: 404 });
  }

  const relationship = parseRelationship(url.searchParams.get("relationship"));
  const genderFilter = parseGender(url.searchParams.get("gender"));

  let selfState: BaziState;
  try {
    selfState = await calculateBaziStateFromRawInput(self.rawInput, { repository });
  } catch (error) {
    const message = error instanceof Error ? error.message : "คำนวณดวงตัวเราไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
  const selfPillars = fourPillars(selfState);
  const text = applyMatchingOverrides(await getMatchingMap());

  const pool = candidates.filter(
    (c) => c.id !== selfId && matchesGender(c.gender, genderFilter),
  );

  const deck = (
    await Promise.all(
      pool.map(async (cand) => {
        try {
          const candState = await calculateBaziStateFromRawInput(cand.rawInput, { repository });
          return buildDeckCard(selfPillars, cand, candState, relationship, text, now);
        } catch {
          return null;
        }
      }),
    )
  ).filter((c): c is DeckCard => c != null);

  // เรียงเกรดดี→น้อย (ผลักคู่ที่สมพงษ์แรงขึ้นก่อน) — คู่ที่หาไม่เจอไปท้าย.
  deck.sort((a, b) => (b.headline.percent ?? -1) - (a.headline.percent ?? -1));

  return Response.json({
    self: personCardOf(self, selfState, now),
    deck,
    relationship,
    matchThreshold: MATCH_THRESHOLD,
    usingSamples,
  });
}
