import type { ReactNode } from "react";

import { buildChapterAnnotation, ChapterChartStrip } from "@/components/bazi/reading/ChapterChartStrip";
import type { RelationshipLineRow } from "@/components/bazi/reading/TopicCard";
import {
  BRANCH_TO_ELEMENT,
  ELEMENT_COLORS_TH,
  ELEMENT_LABELS_TH,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import type {
  CalculatedStateValue,
  PillarValue,
  RawInputValue,
} from "@/lib/bazi/schema-types";

/** หนึ่งบทในเอกสาร PDF (ข้อความ resolve แล้วฝั่ง client: ซินแสแก้ ?? engine humanReading) */
export type PrintChapter = {
  chapter: number;
  title: string;
  /** topic id (ใช้สร้างผังดวงกำกับลูกศรของบท) */
  id?: string;
  /** ข้อความ markdown (อาจมี **ตัวหนา**, ## หัวข้อย่อย, - bullet) */
  text: string | null;
};

type ReadingPrintDocumentProps = {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  chapters: PrintChapter[];
  relationshipLines?: RelationshipLineRow[] | null;
  /** ชื่อเจ้าของดวง (ถ้ามี) — ไม่มีก็ใช้วันเกิดแทนใต้หัวเรื่องบท */
  clientName?: string | null;
};

const KICKER = "ถอดรหัสดวงชะตา";

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);
const YANG_BRANCHES = new Set(["子", "寅", "辰", "午", "申", "戌"]);
const BRANCH_ZODIAC_EN: Record<string, string> = {
  子: "RAT", 丑: "OX", 寅: "TIGER", 卯: "RABBIT", 辰: "DRAGON", 巳: "SNAKE",
  午: "HORSE", 未: "GOAT", 申: "MONKEY", 酉: "ROOSTER", 戌: "DOG", 亥: "PIG",
};
const ELEMENT_ORDER: Array<keyof typeof ELEMENT_LABELS_TH> = ["wood", "fire", "earth", "metal", "water"];

function genderTh(gender: string): string {
  return gender === "male" || gender === "ชาย" ? "ชาย" : "หญิง";
}
function genderSymbol(gender: string): string {
  return gender === "male" || gender === "ชาย" ? "♂" : "♀";
}

function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${d} ${TH_MONTHS[m - 1]} พ.ศ.${y + 543}`;
}

/** ตัด emoji/สัญลักษณ์ตกแต่ง (🤖 🏔 ✨ ฯลฯ) ออกจากข้อความคำทำนาย ไม่ให้รก */
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu;
function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(EMOJI_RE, "").replace(/[ \t]{2,}/g, " ");
}

function elementOfStem(stem: string): keyof typeof ELEMENT_LABELS_TH | undefined {
  return STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];
}
function elementOfBranch(branch: string): keyof typeof ELEMENT_LABELS_TH | undefined {
  return BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT];
}
function colorOf(element: keyof typeof ELEMENT_LABELS_TH | undefined): string {
  if (!element) return "#3d4548";
  return ELEMENT_COLORS_TH[ELEMENT_LABELS_TH[element]] ?? "#3d4548";
}

/* ── เรนเดอร์ markdown ย่อ (ตัวหนา / เน้นแดง / หัวข้อย่อย / bullet / ย่อหน้า) ─ */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  // ***เน้นแดง*** มาก่อน **ตัวหนา**
  const re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={key++} className="ylc-warn">{m[1]}</strong>);
    } else {
      out.push(<strong key={key++}>{m[2]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderMarkdown(text: string): ReactNode[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let key = 0;
  const flushPara = () => {
    if (para.length) {
      blocks.push(<p key={key++}>{renderInline(para.join(" "))}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={key++}>
          {list.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    // บรรทัดขึ้นต้น *** = เน้นเตือนสีแดง (เช่น "*** ระวังเป็นพิเศษ")
    const warnLine = line.match(/^\*\*\*\s*(.+?)\s*\**$/);
    if (warnLine && !line.startsWith("****")) {
      flushPara();
      flushList();
      blocks.push(<p key={key++} className="ylc-warn-line">{renderInline(warnLine[1])}</p>);
      continue;
    }
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      blocks.push(<h4 key={key++} className="ylc-sub">{renderInline(heading[1])}</h4>);
      continue;
    }
    if (bullet) {
      flushPara();
      list.push(bullet[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

/* ── หัวเรื่องบท: kicker + ชื่อ/วันเกิด + เส้นคั่น + "N. ชื่อบท" ──────── */
function SheetHead({ identity, title }: { identity: string; title: string }) {
  return (
    <header className="ylc-head">
      <p className="ylc-head__kicker">{KICKER}</p>
      <p className="ylc-head__name">{identity}</p>
      <div className="ylc-divider" aria-hidden="true">
        <span className="ylc-divider__gem">◆</span>
      </div>
      <h2 className="ylc-head__title">{title}</h2>
    </header>
  );
}

function ContentSheet({ identity, title, children }: { identity: string; title: string; children: ReactNode }) {
  return (
    <section className="ylc-sheet ylc-sheet--content">
      <SheetHead identity={identity} title={title} />
      <div className="ylc-sheet__main">{children}</div>
    </section>
  );
}

/* ── หน้า 4: แผ่นดวงชะตา (ตามรูปสเปก) ───────────────────────────────────── */
function PillarColumn({ label, pillar }: { label: string; pillar: PillarValue | undefined }) {
  if (!pillar) {
    return (
      <div className="ylc-chart-col">
        <div className="ylc-chart-col__head">{label}</div>
        <div className="ylc-chart-col__body">—</div>
      </div>
    );
  }
  const stemEl = elementOfStem(pillar.stem);
  const branchEl = elementOfBranch(pillar.branch);
  const yyStem = YANG_STEMS.has(pillar.stem) ? "YANG" : "YIN";
  const yyBranch = YANG_BRANCHES.has(pillar.branch) ? "YANG" : "YIN";
  const hidden = pillar.hiddenStems ?? [];
  return (
    <div className="ylc-chart-col">
      <div className="ylc-chart-col__head">{label}</div>
      <div className="ylc-chart-cell ylc-chart-cell--stem">
        <span className="ylc-chart-glyph" style={{ color: colorOf(stemEl) }}>{pillar.stem}</span>
        <span className="ylc-chart-en">{yyStem} {stemEl ? stemEl.toUpperCase() : ""}</span>
      </div>
      <div className="ylc-chart-cell ylc-chart-cell--branch">
        <span className="ylc-chart-glyph" style={{ color: colorOf(branchEl) }}>{pillar.branch}</span>
        {hidden.length > 0 ? (
          <span className="ylc-chart-hidden">
            {hidden.map((h, i) => (
              <span key={i} style={{ color: colorOf(elementOfStem(h)) }}>{h}</span>
            ))}
          </span>
        ) : null}
        <span className="ylc-chart-en">{yyBranch} {BRANCH_ZODIAC_EN[pillar.branch] ?? ""}</span>
      </div>
    </div>
  );
}

function MiniPillar({ label, pillar }: { label: string; pillar: PillarValue | undefined }) {
  return (
    <div className="ylc-luck-card">
      <span className="ylc-luck-card__label">{label}</span>
      <div className="ylc-luck-card__glyphs">
        {pillar ? (
          <>
            <span style={{ color: colorOf(elementOfStem(pillar.stem)) }}>{pillar.stem}</span>
            <span style={{ color: colorOf(elementOfBranch(pillar.branch)) }}>{pillar.branch}</span>
          </>
        ) : (
          <span className="ylc-empty">—</span>
        )}
      </div>
    </div>
  );
}

function ChartSheet({
  rawInput,
  calculatedState,
}: {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
}) {
  const cols: { label: string; pillar: PillarValue | undefined }[] = [
    { label: "ลัคนา", pillar: calculatedState.mingGong },
    { label: "ยาม", pillar: calculatedState.fourPillars.hour },
    { label: "ดิถี", pillar: calculatedState.fourPillars.day },
    { label: "เดือน", pillar: calculatedState.fourPillars.month },
    { label: "ปี", pillar: calculatedState.fourPillars.year },
  ];

  const counts = calculatedState.elementAnalysis?.totalCounts;
  const total = counts ? ELEMENT_ORDER.reduce((s, el) => s + (counts[el] ?? 0), 0) : 0;
  const chineseAge = calculatedState.ageSnapshot?.chineseAge;
  const currentDaYun = calculatedState.daYun?.find((d) => d.isCurrent);

  return (
    <section className="ylc-sheet ylc-sheet--chart">
      <div className="ylc-birthbox">
        เกิดวันที่ <b>{thaiDate(rawInput.birthDate)}</b> เวลา <b>{rawInput.birthTime}</b> น.
      </div>
      <p className="ylc-gender">
        <span className="ylc-gender__sym">{genderSymbol(rawInput.gender)}</span> {genderTh(rawInput.gender)}
      </p>

      <div className="ylc-chart-grid">
        {cols.map((c) => (
          <PillarColumn key={c.label} label={c.label} pillar={c.pillar} />
        ))}
      </div>

      {total > 0 && counts ? (
        <div className="ylc-elem">
          <div className="ylc-elembar">
            {ELEMENT_ORDER.map((el) => {
              const n = counts[el] ?? 0;
              if (n <= 0) return null;
              return (
                <span
                  key={el}
                  style={{ width: `${(n / total) * 100}%`, background: colorOf(el) }}
                  title={`${ELEMENT_LABELS_TH[el]} ${n}`}
                />
              );
            })}
          </div>
          <div className="ylc-elem-legend">
            {ELEMENT_ORDER.map((el) => (
              <span key={el} className="ylc-elem-legend__item">
                <i style={{ background: colorOf(el) }} /> {ELEMENT_LABELS_TH[el]} {counts[el] ?? 0}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="ylc-luck">
        <h3 className="ylc-luck__title">วัยจร</h3>
        {typeof chineseAge === "number" ? (
          <>
            <p className="ylc-luck__age">อายุ (จีน): {chineseAge}</p>
            <p className="ylc-luck__note">* อายุจีน = อายุไทย + 1</p>
          </>
        ) : null}
        <div className="ylc-luck-cards">
          <MiniPillar label="ปีจร" pillar={calculatedState.liuNian} />
          <MiniPillar
            label="วัยจร"
            pillar={currentDaYun ? { stem: currentDaYun.stem, branch: currentDaYun.branch } : undefined}
          />
        </div>
      </div>

      <footer className="ylc-sheet__footer">
        <img src="/ylc/logo-footer.png" alt="mumate" />
      </footer>
    </section>
  );
}

/**
 * เอกสารคำทำนาย 15 บท สไตล์ YLC (YOUR LIFE CODE / Mumate) สำหรับ preview + พิมพ์เป็น PDF
 * โครงสร้าง: ปก(1) → คำนำ(2) → สารบัญ(3) → แผ่นดวงชะตา(4) → 15 บท → ภาคผนวก → ปกหลัง(QR)
 * เนื้อหา resolve มาแล้วฝั่ง client (ตรงกับที่แสดงบนหน้า /reading) — ข้อความเรนเดอร์ markdown
 */
export function ReadingPrintDocument({
  rawInput,
  calculatedState,
  chapters,
  relationshipLines,
  clientName,
}: ReadingPrintDocumentProps) {
  const identity = clientName?.trim() || `เกิด ${thaiDate(rawInput.birthDate)}`;

  return (
    <article className="ylc-doc">
      {/* 1 ── ปก ── */}
      <section className="ylc-sheet ylc-sheet--image">
        <img src="/ylc/cover.jpg" alt="Your Life Code — คู่มือดวงจีน เฉพาะบุคคล" />
      </section>

      {/* 2 ── คำนำ ── */}
      <section className="ylc-sheet ylc-sheet--image">
        <img src="/ylc/intro.jpg" alt="คำนำ Your Life Code" />
      </section>

      {/* 3 ── สารบัญ ── */}
      <section className="ylc-sheet ylc-sheet--image">
        <img src="/ylc/toc.jpg" alt="หมวดหมู่ดวงจีน — สารบัญ 15 บท" />
      </section>

      {/* 4 ── แผ่นดวงชะตา (วันเวลาเกิด) ── */}
      <ChartSheet rawInput={rawInput} calculatedState={calculatedState} />

      {/* 5.. ── 15 บท (พร้อมผังดวงกำกับลูกศรของบท ถ้ามี relationKeys) ── */}
      {chapters.map((ch) => {
        const annotation = ch.id ? buildChapterAnnotation(calculatedState, ch.id) : null;
        return (
          <ContentSheet key={ch.chapter} identity={identity} title={`${ch.chapter}. ${ch.title}`}>
            {annotation ? <ChapterChartStrip annotation={annotation} /> : null}
            <div className="ylc-prose">
              {ch.text ? renderMarkdown(cleanText(ch.text)) : <p className="ylc-empty">(ยังไม่ได้ทำนายบทนี้)</p>}
            </div>
          </ContentSheet>
        );
      })}

      {/* ── ภาคผนวก: ตารางวัยจรเชิงลึก ── */}
      {relationshipLines && relationshipLines.length > 0 ? (
        <ContentSheet identity={identity} title="บทเสริม · ตารางวิเคราะห์เส้นขีดความสัมพันธ์ (วัยจรช่วงละ 5 ปี)">
          <table className="ylc-table ylc-table--appendix">
            <colgroup>
              <col className="ylc-col-age" />
              <col className="ylc-col-pillar" />
              <col className="ylc-col-desc" />
            </colgroup>
            <thead>
              <tr>
                <th>ช่วงอายุ</th>
                <th>เสาวัยจร</th>
                <th>คำอธิบายดี-ร้ายเชิงลึก</th>
              </tr>
            </thead>
            <tbody>
              {relationshipLines.map((row, i) => (
                <tr key={`${row.ageRange}-${i}`}>
                  <td>{row.ageRange}</td>
                  <td>{row.symbol}</td>
                  <td className="ylc-cell-desc">
                    {row.relationLine ? <strong>{cleanText(row.relationLine)}</strong> : null}
                    {cleanText(row.deepNote)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContentSheet>
      ) : null}

      {/* ── ปกหลัง (QR code / LINE) ── */}
      <section className="ylc-sheet ylc-sheet--image">
        <img src="/ylc/back-cover.jpg" alt="MUMATE — Your Fortune, Your Friend · LINE @mumate.co" />
      </section>
    </article>
  );
}
