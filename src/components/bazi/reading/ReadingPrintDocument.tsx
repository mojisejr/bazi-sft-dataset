import type { ReactNode } from "react";

import { buildChapterAnnotation, ChapterChartStrip } from "@/components/bazi/reading/ChapterChartStrip";
import {
  ChartPillarTable,
  colorOf,
  elementOfBranch,
  elementOfStem,
} from "@/components/bazi/reading/ChartPillarTable";
import type { RelationshipLineRow } from "@/components/bazi/reading/TopicCard";
import { tokenizeInline } from "@/lib/bazi/reading-inline";
import {
  ELEMENT_LABELS_TH,
} from "@/lib/bazi/symbolic-engine.constants";
import type {
  CalculatedStateValue,
  PillarValue,
  RawInputValue,
} from "@/lib/bazi/schema-types";

/* ตารางเสาใช้ร่วม (หน้าแผ่นดวง + กำกับบท) ย้ายไป ChartPillarTable.tsx */
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
  /**
   * โหมดแก้ (edit): render เนื้อบทเป็น editable แทน markdown read-only
   * ถ้ามี → หนึ่งแผ่นต่อบท (ไม่ split ตาม [[pagebreak]] — ตัวแบ่งหน้าเป็น marker ใน editor)
   */
  renderChapterBody?: (chapter: PrintChapter) => ReactNode;
  /** โหมดแก้: render ตารางวัยจรท้ายเล่มเป็น editable แทน table read-only */
  renderAppendix?: () => ReactNode;
  /** โหมดแก้: ยุบหน้ารูปเต็มหน้า (ปก/คำนำ/สารบัญ/ปกหลัง) เป็นแถบ placeholder ให้เอกสารสั้นลง */
  editLayout?: boolean;
};

/** หน้ารูปเต็มหน้า — โหมดปกติแสดง <img>; โหมดแก้ยุบเป็นแถบ placeholder (มี label จาก alt) */
function ImageSheet({ src, alt, label, editLayout }: { src: string; alt: string; label: string; editLayout?: boolean }) {
  if (editLayout) {
    return (
      <section className="ylc-sheet ylc-sheet--imgph" aria-label={alt}>
        <span className="ylc-imgph__tag">รูปเต็มหน้า</span>
        <span className="ylc-imgph__label">{label}</span>
      </section>
    );
  }
  return (
    <section className="ylc-sheet ylc-sheet--image">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
    </section>
  );
}

const KICKER = "ถอดรหัสดวงชะตา";

/** marker บรรทัดเดี่ยวสั่งขึ้นหน้าใหม่ (ซินแสแทรกในข้อความ) — ต้องตรงกับ reading-docx.ts */
const PAGEBREAK_MARKER = "[[pagebreak]]";
/** marker นำหน้าบรรทัดแรกของย่อหน้าที่เยื้องบรรทัดแรก — ต้องตรงกับ reading-markdown / reading-docx */
const INDENT_MARKER = "[[indent]]";

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

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
  // ตัด emoji ออก แต่ "คงช่องว่าง" ที่ผู้ใช้พิมพ์ (เดิมยุบ [ \t]{2,}→" " ทำให้กด space หลายตัวเหลือ 1)
  // การโชว์ช่องว่างจริงอาศัย white-space: pre-wrap ที่ .ylc-prose
  return text.replace(EMOJI_RE, "");
}

/* ── เรนเดอร์ markdown ย่อ (ตัวหนา / เน้นแดง / สี / หัวข้อย่อย / bullet / ย่อหน้า) ─
   ใช้ tokenizer กลาง (reading-inline) ตัวเดียวกับ docx/converter — กันตีความไม่ตรง */
function renderInline(text: string): ReactNode[] {
  return tokenizeInline(text).map((r, i) => {
    const fontSize = r.fontSize;
    if (r.color) {
      return (
        <span key={i} style={{ color: r.color, fontWeight: r.bold ? 700 : undefined, fontSize }}>
          {r.text}
        </span>
      );
    }
    if (r.red) {
      return <strong key={i} className="ylc-warn" style={fontSize ? { fontSize } : undefined}>{r.text}</strong>;
    }
    if (r.bold) return <strong key={i} style={fontSize ? { fontSize } : undefined}>{r.text}</strong>;
    if (fontSize) return <span key={i} style={{ fontSize }}>{r.text}</span>;
    return r.text;
  });
}

function renderMarkdown(text: string): ReactNode[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let paraIndent = false;
  let list: string[] = [];
  let key = 0;
  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={key++} className={paraIndent ? "ylc-indent" : undefined}>
          {renderInline(para.join(" "))}
        </p>,
      );
      para = [];
      paraIndent = false;
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
    if (!para.length) {
      // บรรทัดแรกของย่อหน้า: [[indent]] = เยื้อง 2em มิฉะนั้นคงช่องว่างนำหน้าที่พิมพ์เอง (trimEnd อย่างเดียว)
      if (line.startsWith(INDENT_MARKER)) {
        paraIndent = true;
        para.push(line.slice(INDENT_MARKER.length).replace(/^\s+/, ""));
      } else {
        para.push(raw.replace(/\s+$/, ""));
      }
    } else {
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

const APPENDIX_TITLE = "บทเสริม · ตารางวิเคราะห์เส้นขีดความสัมพันธ์ (วัยจรช่วงละ 5 ปี)";

/** ตารางบทเสริม (วัยจรช่วงละ 5 ปี) — ใช้ทั้งในเอกสารเต็มและมินิพรีวิวบทเสริม */
function AppendixTable({ relationshipLines }: { relationshipLines: RelationshipLineRow[] }) {
  return (
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
  );
}

/** แตกแถวบทเสริมเป็นกลุ่มตาม pageBreakBefore — แต่ละกลุ่ม = หนึ่ง ContentSheet (หนึ่งหน้า A4) */
function appendixGroups(rows: RelationshipLineRow[]): RelationshipLineRow[][] {
  const groups: RelationshipLineRow[][] = [];
  for (const row of rows) {
    if (groups.length === 0 || row.pageBreakBefore) groups.push([row]);
    else groups[groups.length - 1].push(row);
  }
  return groups;
}

/** บทเสริมเป็นแผ่น A4 (แตกหน้าตาม pageBreakBefore) — sheet แรกมีหัว + chapterId ให้ตัวนับจำนวนหน้า */
function AppendixSheets({ identity, relationshipLines }: { identity: string; relationshipLines: RelationshipLineRow[] }) {
  return (
    <>
      {appendixGroups(relationshipLines).map((group, gi) => (
        <ContentSheet
          key={gi}
          identity={identity}
          title={APPENDIX_TITLE}
          chapterId={gi === 0 ? "appendix" : undefined}
          showHead={gi === 0}
        >
          <AppendixTable relationshipLines={group} />
        </ContentSheet>
      ))}
    </>
  );
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

function ContentSheet({
  identity,
  title,
  children,
  chapterId,
  showHead = true,
}: {
  identity: string;
  title: string;
  children: ReactNode;
  /** tag จุดเริ่มบท (data-ch-start) ให้ตัวนับจำนวนหน้า map บท→หน้าได้ */
  chapterId?: string;
  /** false = หน้าต่อ ([[pagebreak]] กลางบท) ไม่ต้องซ้ำหัวข้อบท */
  showHead?: boolean;
}) {
  return (
    <section className="ylc-sheet ylc-sheet--content" data-ch-start={chapterId}>
      {showHead ? <SheetHead identity={identity} title={title} /> : null}
      <div className="ylc-sheet__main">{children}</div>
    </section>
  );
}

/* ── หน้า 4: แผ่นดวงชะตา (ตามรูปสเปก) ───────────────────────────────────── */
type LuckGlyph = { symbol: string; color: string };

function MiniPillar({
  label,
  pillar,
  single,
}: {
  label: string;
  pillar?: PillarValue;
  /** โชว์ glyph เดียว (วัยจร: ครึ่ง 5 ปีที่ตรงอายุปัจจุบัน) แทนก้าน+กิ่ง */
  single?: LuckGlyph;
}) {
  return (
    <div className="ylc-luck-card">
      <span className="ylc-luck-card__label">{label}</span>
      <div className="ylc-luck-card__glyphs">
        {single ? (
          <span style={{ color: single.color }}>{single.symbol}</span>
        ) : pillar ? (
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

/** วัยจรปัจจุบันโชว์ตัวเดียว: ครึ่งก้าน (5 ปีแรก) หรือครึ่งกิ่ง (5 ปีหลัง) ตามอายุจริง */
function currentLuckGlyph(daYun: CalculatedStateValue["daYun"]): LuckGlyph | undefined {
  const cur = daYun?.find((d) => d.isCurrent);
  if (!cur) return undefined;
  const phase =
    cur.currentPhase === "lower"
      ? cur.lowerPhase
      : cur.currentPhase === "upper"
        ? cur.upperPhase
        : cur.upperPhase?.isCurrent
          ? cur.upperPhase
          : cur.lowerPhase?.isCurrent
            ? cur.lowerPhase
            : cur.upperPhase ?? cur.lowerPhase;
  if (phase) {
    const el = phase.source === "stem" ? elementOfStem(phase.symbol) : elementOfBranch(phase.symbol);
    return { symbol: phase.symbol, color: colorOf(el) };
  }
  // เอกสารเก่าไม่มีข้อมูล phase → fallback เป็นครึ่งก้าน
  return { symbol: cur.stem, color: colorOf(elementOfStem(cur.stem)) };
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
  const luckGlyph = currentLuckGlyph(calculatedState.daYun);

  return (
    <section className="ylc-sheet ylc-sheet--chart">
      <div className="ylc-birthbox">
        เกิดวันที่ <b>{thaiDate(rawInput.birthDate)}</b> เวลา <b>{rawInput.birthTime}</b> น.
      </div>
      <p className="ylc-gender">
        <span className="ylc-gender__sym">{genderSymbol(rawInput.gender)}</span> {genderTh(rawInput.gender)}
      </p>

      <ChartPillarTable cols={cols} variant="full" />

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
          <MiniPillar label="วัยจร" single={luckGlyph} />
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
  renderChapterBody,
  renderAppendix,
  editLayout,
}: ReadingPrintDocumentProps) {
  const identity = clientName?.trim() || `เกิด ${thaiDate(rawInput.birthDate)}`;

  return (
    <article className="ylc-doc">
      {/* 1 ── ปก ── */}
      <ImageSheet src="/ylc/cover.jpg" alt="Your Life Code — คู่มือดวงจีน เฉพาะบุคคล" label="ปก" editLayout={editLayout} />

      {/* 2 ── คำนำ ── */}
      <ImageSheet src="/ylc/intro.jpg" alt="คำนำ Your Life Code" label="คำนำ" editLayout={editLayout} />

      {/* 3 ── สารบัญ ── */}
      <ImageSheet src="/ylc/toc.jpg" alt="หมวดหมู่ดวงจีน — สารบัญ 15 บท" label="สารบัญ" editLayout={editLayout} />

      {/* 4 ── แผ่นดวงชะตา (วันเวลาเกิด) ── */}
      <ChartSheet rawInput={rawInput} calculatedState={calculatedState} />

      {/* 5.. ── 15 บท (พร้อมผังดวงกำกับลูกศรของบท ถ้ามี relationKeys) ──
          ตัวแบ่งหน้า manual ([[pagebreak]]) ที่ซินแสแทรก = ตัดบทเป็นหลายแผ่น (sheet) ต่อเนื่อง
          ใช้กลไก .ylc-sheet + .ylc-sheet { break-before: page } ที่เสถียร (ไม่ใช้ break-before
          บน element เปล่าใน prose เพราะ paged.js build นี้จะวนค้าง) */}
      {chapters.flatMap((ch) => {
        const annotation = ch.id ? buildChapterAnnotation(calculatedState, ch.id) : null;
        // โหมดแก้: หนึ่งแผ่นต่อบท เนื้อหาเป็น editor (ตัวแบ่งหน้าเป็น marker ใน editor ไม่ split แผ่น)
        if (renderChapterBody) {
          return [
            <ContentSheet key={`${ch.chapter}-edit`} identity={identity} title={`${ch.chapter}. ${ch.title}`}>
              {annotation ? <ChapterChartStrip annotation={annotation} uid={ch.id ?? String(ch.chapter)} /> : null}
              <div className="ylc-prose">{renderChapterBody(ch)}</div>
            </ContentSheet>,
          ];
        }
        const raw = ch.text ?? "";
        const parts = raw.includes(PAGEBREAK_MARKER)
          ? raw.split(PAGEBREAK_MARKER).map((s) => s.trim()).filter((s) => s.length > 0)
          : [raw];
        const segments = parts.length > 0 ? parts : [raw];
        return segments.map((segText, si) => (
          <ContentSheet
            key={`${ch.chapter}-${si}`}
            identity={identity}
            title={`${ch.chapter}. ${ch.title}`}
            chapterId={si === 0 ? ch.id : undefined}
            showHead={si === 0}
          >
            {si === 0 && annotation ? <ChapterChartStrip annotation={annotation} uid={ch.id ?? String(ch.chapter)} /> : null}
            <div className="ylc-prose">
              {segText ? renderMarkdown(cleanText(segText)) : <p className="ylc-empty">(ยังไม่ได้ทำนายบทนี้)</p>}
            </div>
          </ContentSheet>
        ));
      })}

      {/* ── ภาคผนวก: ตารางวัยจรเชิงลึก ── */}
      {renderAppendix && relationshipLines && relationshipLines.length > 0 ? (
        <ContentSheet identity={identity} title={APPENDIX_TITLE}>
          {renderAppendix()}
        </ContentSheet>
      ) : null}
      {!renderAppendix && relationshipLines && relationshipLines.length > 0 ? (
        <AppendixSheets identity={identity} relationshipLines={relationshipLines} />
      ) : null}

      {/* ── ปกหลัง (QR code / LINE) ── */}
      <ImageSheet
        src="/ylc/back-cover.jpg"
        alt="MUMATE — Your Fortune, Your Friend · LINE @mumate.co"
        label="ปกหลัง (QR / LINE)"
        editLayout={editLayout}
      />
    </article>
  );
}

/**
 * เรนเดอร์ "บทเดียว" เป็น .ylc-doc สำหรับมินิพรีวิวหน้าจริง (paged.js) ในแผงแก้
 * โครงเหมือน chapters-map ของเอกสารเต็มทุกอย่าง (chart strip + split [[pagebreak]]) →
 * เพราะทุกบทเริ่มหัวหน้า (break-before: page) การจัดหน้าบทเดี่ยวจึง = หน้าเดียวกับใน PDF เต็ม
 */
export function SingleChapterDocument({
  rawInput,
  calculatedState,
  chapter,
  clientName,
}: {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  chapter: PrintChapter;
  clientName?: string | null;
}) {
  const identity = clientName?.trim() || `เกิด ${thaiDate(rawInput.birthDate)}`;
  const annotation = chapter.id ? buildChapterAnnotation(calculatedState, chapter.id) : null;
  const raw = chapter.text ?? "";
  const parts = raw.includes(PAGEBREAK_MARKER)
    ? raw.split(PAGEBREAK_MARKER).map((s) => s.trim()).filter((s) => s.length > 0)
    : [raw];
  const segments = parts.length > 0 ? parts : [raw];
  return (
    <article className="ylc-doc">
      {segments.map((segText, si) => (
        <ContentSheet
          key={si}
          identity={identity}
          title={`${chapter.chapter}. ${chapter.title}`}
          showHead={si === 0}
        >
          {si === 0 && annotation ? (
            <ChapterChartStrip annotation={annotation} uid={chapter.id ?? String(chapter.chapter)} />
          ) : null}
          <div className="ylc-prose">
            {segText ? renderMarkdown(cleanText(segText)) : <p className="ylc-empty">(ยังไม่ได้ทำนายบทนี้)</p>}
          </div>
        </ContentSheet>
      ))}
    </article>
  );
}

/**
 * เรนเดอร์ "บทเสริม" (ตารางวัยจร) เป็น .ylc-doc สำหรับมินิพรีวิวหน้าจริง (paged.js) ในแผงแก้
 * โครงตรงกับหน้าบทเสริมในเอกสารเต็ม — ให้ซินแสเห็นหน้าจริงของบทเสริมขณะแก้ตาราง
 */
export function SingleAppendixDocument({
  rawInput,
  relationshipLines,
  clientName,
}: {
  rawInput: RawInputValue;
  relationshipLines: RelationshipLineRow[];
  clientName?: string | null;
}) {
  const identity = clientName?.trim() || `เกิด ${thaiDate(rawInput.birthDate)}`;
  return (
    <article className="ylc-doc">
      <AppendixSheets identity={identity} relationshipLines={relationshipLines} />
    </article>
  );
}
