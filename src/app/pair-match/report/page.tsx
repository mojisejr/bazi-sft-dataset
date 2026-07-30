import { buildFacets, buildPairComparison, mainFacetOf, RELATIONSHIP_SPECS } from "@/lib/bazi/pair-matching";
import { applyMatchingOverrides } from "@/lib/bazi/matching-overlay";
import { getMatchingMap } from "@/lib/bazi/matching.server";
import {
  gradeLabelOf,
  heartsOf,
  PAIR_MATCH_DEFAULT_BIRTH_TIME,
  PAIR_MATCH_DEFAULT_PROVINCE,
  RELATIONSHIP_INPUT_VALUES,
  relationshipLabelOverride,
  relationshipNoteOf,
  resolveOverallGrade,
  toEngineRelationship,
  type RelationshipInput,
} from "@/lib/bazi/pair-consumer";
import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import type { DayPillar, PillarPos } from "@/lib/bazi/pair-types";

import { AutoPrint } from "./AutoPrint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /pair-match/report — รายงานผลจับคู่ (จอ "บันทึกเป็น PDF" ของ wizard).
 * Server-render จาก query params เพื่อให้ UI ใหม่ (คนละ frontend) แค่เปิดลิงก์:
 *   /pair-match/report?relationship=love
 *     &aDate=1996-01-12&aTime=09:30&aName=สิริวรรณ
 *     &bDate=1994-07-07&bTime=18:15&bName=ธนกร
 *     &print=1   ← เปิดแล้วเด้ง dialog พิมพ์ (Save as PDF) อัตโนมัติ
 */

type Search = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

type PersonQuery = {
  birthDate: string;
  birthTime: string | null;
  displayName: string | null;
};

function personFrom(sp: Search, prefix: "a" | "b"): PersonQuery | string {
  const date = str(sp[`${prefix}Date`]);
  if (!date || !DATE_RE.test(date)) return `${prefix}Date ต้องเป็น YYYY-MM-DD`;
  const time = str(sp[`${prefix}Time`]);
  if (time && !TIME_RE.test(time)) return `${prefix}Time ต้องเป็น HH:mm`;
  return { birthDate: date, birthTime: time, displayName: str(sp[`${prefix}Name`]) };
}

type CalculatedState = Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>;

function dayPillarOf(state: CalculatedState): DayPillar {
  return { stem: state.fourPillars.day.stem, branch: state.fourPillars.day.branch };
}

function facetPillarsOf(state: CalculatedState): Record<PillarPos, DayPillar> {
  const p = state.fourPillars;
  const lite = (x: { stem: string; branch: string }): DayPillar => ({ stem: x.stem, branch: x.branch });
  return { hour: lite(p.hour), day: lite(p.day), month: lite(p.month), year: lite(p.year) };
}

function thaiBirthText(p: PersonQuery): string {
  const [y, m, d] = p.birthDate.split("-").map(Number);
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const base = `${d} ${months[(m ?? 1) - 1]} ${y + 543}`;
  return p.birthTime ? `${base} เวลา ${p.birthTime} น.` : `${base} (ไม่ทราบเวลาเกิด)`;
}

function Hearts({ n }: { n: number }) {
  return (
    <span className="pair-report__hearts" aria-label={`${n} จาก 5 หัวใจ`}>
      {"♥".repeat(n)}
      <span className="pair-report__hearts-empty">{"♥".repeat(5 - n)}</span>
    </span>
  );
}

export default async function PairMatchReportPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const relRaw = str(sp.relationship) ?? "love";
  const relationshipInput: RelationshipInput = (RELATIONSHIP_INPUT_VALUES as readonly string[]).includes(relRaw)
    ? (relRaw as RelationshipInput)
    : "love";
  const personA = personFrom(sp, "a");
  const personB = personFrom(sp, "b");

  if (typeof personA === "string" || typeof personB === "string") {
    const errors = [personA, personB].filter((x): x is string => typeof x === "string");
    return (
      <main className="pair-report-page">
        <div className="pair-report__error">
          <h1>พารามิเตอร์ไม่ถูกต้อง</h1>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p>
            ตัวอย่าง: <code>/pair-match/report?relationship=love&aDate=1996-01-12&aTime=09:30&bDate=1994-07-07</code>
          </p>
        </div>
      </main>
    );
  }

  const relationship = toEngineRelationship(relationshipInput);
  const spec = RELATIONSHIP_SPECS[relationship];
  const repository = createDbKnowledgeRepository();
  const toRawInput = (p: PersonQuery) => ({
    birthDate: p.birthDate,
    birthTime: p.birthTime ?? PAIR_MATCH_DEFAULT_BIRTH_TIME,
    gender: "unspecified",
    province: PAIR_MATCH_DEFAULT_PROVINCE,
  });
  const [stateA, stateB] = await Promise.all([
    calculateBaziStateFromRawInput(toRawInput(personA), { repository }),
    calculateBaziStateFromRawInput(toRawInput(personB), { repository }),
  ]);

  const text = applyMatchingOverrides(await getMatchingMap());
  const comparison = buildPairComparison(dayPillarOf(stateA), dayPillarOf(stateB), text);
  const facets = buildFacets(relationship, facetPillarsOf(stateA), facetPillarsOf(stateB), text);
  const mainFacet = mainFacetOf(facets);

  const fallback = comparison.match[spec.domain];
  const overallPercent = mainFacet?.percent ?? fallback.overallPercent;
  // sibling ของ route /pair-match — เลือกเกรดด้วย helper เดียวกัน ไหลไป fallback เมื่อเกรดหลักว่าง
  const overallGrade = resolveOverallGrade(mainFacet?.percent, mainFacet?.grade, fallback.overallGrade);
  const relationshipLabel = relationshipLabelOverride(relationshipInput) ?? spec.label;
  const note = relationshipNoteOf(relationshipInput);

  const dateText = new Date().toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });

  const people = [
    { who: spec.ourLabel, q: personA, p: comparison.personA },
    { who: spec.partnerLabel, q: personB, p: comparison.personB },
  ];

  return (
    <main className="pair-report-page">
      <AutoPrint auto={str(sp.print) === "1"} />

      <div className="pair-print-report pair-report">
        <header className="pair-print__header">
          <h1>รายงานผลจับคู่ดวง · {relationshipLabel}</h1>
          <p className="pair-print__date">จัดทำเมื่อ {dateText}</p>
        </header>

        <section className="pair-print__people">
          {people.map(({ who, q, p }) => (
            <div key={who} className="pair-print__person">
              <h3>
                {who}
                {q.displayName ? ` — ${q.displayName}` : ""}
              </h3>
              <p className="pair-print__birth">{thaiBirthText(q)}</p>
              <p>
                หลักวัน {p.dayPillar.stem}{p.dayPillar.branch} · ดิถีธาตุ{p.elementTh}
                {p.stageTh ? ` · ${p.stageTh}` : ""}
              </p>
              <ul>
                {p.nisai.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="pair-print__domain pair-report__overall">
          <h2 className="pair-print__domain-title">คะแนนความเข้ากันโดยรวม</h2>
          <p className="pair-report__score">
            <span className="pair-report__grade">{overallGrade}</span>
            <span className="pair-report__percent">{overallPercent != null ? `${overallPercent}%` : "-"}</span>
          </p>
          <p className="pair-print__verdict">
            {gradeLabelOf(overallPercent)} <Hearts n={heartsOf(overallPercent)} />
          </p>
          {mainFacet ? <p>{mainFacet.ratingText}</p> : null}
          {note ? <p className="pair-report__note">หมายเหตุ: {note}</p> : null}
        </section>

        <section className="pair-print__domain">
          <h2 className="pair-print__domain-title">คะแนนรายมิติ</h2>
          {facets.map((f) => (
            <div key={f.key} className="pair-print__dir pair-report__facet">
              <p className="pair-print__dir-head">
                {f.label} <span className="pair-print__sub">({f.pairingLabel})</span> —{" "}
                <strong>{f.grade}</strong> ({f.percent ?? "-"}%) · {gradeLabelOf(f.percent)}
                {f.isMain ? " · ⭐ คำทำนายหลัก" : ""}
              </p>
              <p>{f.ratingText}</p>
              {f.sising ? (
                <p className="pair-print__sub">
                  สี่ซิ้ง: {f.sising.nameTh} — {f.sising.short}
                </p>
              ) : null}
            </div>
          ))}
        </section>

        <section className="pair-print__domain">
          <h2 className="pair-print__domain-title">ปฏิกิริยาธาตุ</h2>
          <p className="pair-print__elem">
            ธาตุ{comparison.elementInteraction.aElementTh} × ธาตุ{comparison.elementInteraction.bElementTh} —{" "}
            {comparison.elementInteraction.summaryTh}
          </p>
        </section>

        <footer className="pair-print__footer">
          จับคู่จากเสาดวงตามตำราคู่สมพงษ์ · คำทำนายหลักคือมิติ ⭐ ตามที่ซินแสกำหนด
        </footer>
      </div>
    </main>
  );
}
