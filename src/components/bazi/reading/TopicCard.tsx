"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { StatusChip } from "@/components/bazi/primitives/StatusChip";
import { Surface } from "@/components/bazi/primitives/Surface";
import { SinsaeRuleBuilder, type AddRuleInput } from "@/components/bazi/reading/SinsaeRuleBuilder";
import { READING_COLORS } from "@/lib/bazi/reading-colors";
import { tokenizeInline } from "@/lib/bazi/reading-inline";
import {
  compileKnowledgeTables,
  resolveParagraphSources,
  type KnowledgeTableLite,
} from "@/lib/bazi/reading-source-match";
import { suggestSubstitutions } from "@/lib/bazi/substitution-rules";
import type { SinsaeCorrection } from "@/lib/bazi/sinsae-corrections";
import type { TopicDefinition, TopicEngineReading } from "@/lib/bazi/topic-reading";

export type TopicReadingMode = "engine" | "llm";

export type RelationshipLineRow = {
  ageRange: string;
  symbol: string;
  relationLine: string;
  deepNote: string;
  /** true = ขึ้นหน้าใหม่ก่อนแถวนี้ในตารางบทเสริม (PDF/Word/พรีวิว) */
  pageBreakBefore?: boolean;
};

export type TopicReadingResult = {
  source: "engine" | "llm";
  model?: string;
  reading: TopicEngineReading;
  /** ผลการทำนายภาษามนุษย์ (engine = จาก knownlage, llm = ขัดเกลา) — null ถ้ายังไม่มีองค์ความรู้ */
  humanReading?: string | null;
  /** ข้อความตำรา (knownlage) ตรง ๆ ก่อนเรียบเรียง — ใช้ในส่วน "คำอ่าน" */
  knownlageExcerpt?: string[] | null;
  /** ชื่อตำรา/แหล่งอ้างอิง */
  sourceLabel?: string | null;
  /** ตารางเส้นขีดความสัมพันธ์หมวดวัยจร (เฉพาะ turning_points) */
  relationshipLines?: RelationshipLineRow[];
};

type TopicCardStatus = "idle" | "loading" | "done" | "error";

type TopicCardProps = {
  topic: TopicDefinition;
  disabled: boolean;
  status: TopicCardStatus;
  result: TopicReadingResult | null;
  errorMessage: string | null;
  /** API key รวมจากส่วนกลาง (ใช้เมื่อโหมด llm) */
  apiKey: string;
  onPredict: (topicId: string, mode: TopicReadingMode, apiKey: string | null) => void;
  /** คำแก้ของซินแสสำหรับดวงนี้บทนี้ (ถ้ามี) — ใช้ override คำของระบบ */
  savedCorrection?: SinsaeCorrection | null;
  /** จำนวนคำแก้ของซินแสจากดวงอื่นที่ผลคล้ายกัน (ป้อนให้ LLM เมื่อทำนายซ้ำโหมด LLM) */
  similarCount?: number;
  onSaveCorrection?: (topicId: string, text: string) => void;
  onClearCorrection?: (topicId: string) => void;
  /** เพิ่มกฎแทนคำ (ใช้กับดวงอื่น) */
  onAddRule?: (input: AddRuleInput) => void | Promise<void>;
  /** เพิ่มกฎแทนคำหลายรายการพร้อมกัน (ปุ่ม "บันทึกเป็นกฎทั้งหมด") */
  onAddRules?: (inputs: AddRuleInput[]) => void | Promise<void>;
};

function CollapsibleBlock({
  title,
  source,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  source?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`topic-card__block topic-card__collapsible${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="topic-card__collapse-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="topic-card__collapse-caret" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        <span className="topic-card__collapse-title">{title}</span>
        {source && <span className="topic-card__source">{source}</span>}
      </button>
      {open && <div className="topic-card__collapse-body">{children}</div>}
    </section>
  );
}

const CARD_BOX_OPEN_RE = /^\[\[box=(.*)\]\]$/;
const CARD_BOX_CLOSE = "[[/box]]";

/** segment ของผลทำนาย: ข้อความล้วน (text) หรือ กล่องหัวข้อย่อย (box{title, body}) */
type ReadingSegment =
  | { kind: "text"; raw: string }
  | { kind: "box"; title: string; body: string };

/** แยกผลทำนายเป็น segments — กล่อง [[box=หัวข้อ]]..[[/box]] (รองรับซ้อน) คั่นด้วยข้อความล้วน */
function parseReadingSegments(text: string): ReadingSegment[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const segs: ReadingSegment[] = [];
  let buf: string[] = [];
  const flush = () => {
    const raw = buf.join("\n").trim();
    buf = [];
    if (raw) segs.push({ kind: "text", raw });
  };
  for (let i = 0; i < lines.length; i++) {
    const boxOpen = lines[i].trim().match(CARD_BOX_OPEN_RE);
    if (boxOpen) {
      flush();
      const title = boxOpen[1].trim();
      const inner: string[] = [];
      let depth = 1;
      i++;
      for (; i < lines.length; i++) {
        const t = lines[i].trim();
        if (CARD_BOX_OPEN_RE.test(t)) {
          depth++;
        } else if (t === CARD_BOX_CLOSE) {
          depth--;
          if (depth === 0) break;
        }
        inner.push(lines[i]);
      }
      segs.push({ kind: "box", title, body: inner.join("\n").trim() });
      continue;
    }
    buf.push(lines[i]);
  }
  flush();
  return segs;
}

/** ประกอบ segments กลับเป็น markdown (กล่อง = [[box=หัวข้อ]]..[[/box]]) — round-trip กับ parseReadingSegments */
function serializeReadingSegments(segs: ReadingSegment[]): string {
  return segs
    .map((seg) => (seg.kind === "box" ? `[[box=${seg.title}]]\n${seg.body}\n[[/box]]` : seg.raw))
    .join("\n\n");
}

/**
 * normalize เนื้อในกล่องที่ซินแสพิมพ์ — ทุกครั้งที่กด Enter (ขึ้นบรรทัดใหม่) ให้กลายเป็น "ย่อหน้าใหม่"
 * (markdown เดิม: บรรทัดติดกัน \n เดียวจะถูกยุบรวมเป็นย่อหน้าเดียว → ที่ซินแสพิมพ์แยกบรรทัดเลยหาย)
 * ยกเว้น bullet ติดกัน (`- `) คงไว้บรรทัดเดียวกัน เพื่อให้เป็นลิสต์เดียว
 */
function normalizeBoxBody(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n").map((line) => line.trim());
  let result = "";
  let prevWasBullet = false;
  let first = true;
  for (const line of lines) {
    if (!line) {
      prevWasBullet = false;
      continue;
    }
    const isBullet = /^[-*•]\s+/.test(line);
    if (first) {
      result = line;
      first = false;
    } else if (isBullet && prevWasBullet) {
      result += `\n${line}`;
    } else {
      result += `\n\n${line}`;
    }
    prevWasBullet = isBullet;
  }
  return result;
}

/** entityKey ของช่อง catalog (ตรงกับ encodeKnowledgeEntityKey ฝั่ง server: `table|tableId|key`) */
function knowledgeTableEntityKey(tableId: string, key: string): string {
  return `table|${tableId}|${key}`;
}

/** แยกเนื้อกล่องเป็นย่อหน้า (= "ชิ้น" ที่ engine ประกอบด้วย composeParagraphs คั่น \n\n) */
function splitBoxParagraphs(body: string): string[] {
  return body
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * label สั้นของย่อหน้า (heuristic ฝั่ง client) — สะท้อนรูปแบบที่ engine สร้าง:
 *  "เกิดถูกฤดู — …" → "เกิดถูกฤดู" · "กำลังดิถีโดยรวม: …" → "กำลังดิถีโดยรวม" · ไม่งั้น "ย่อหน้า #n"
 */
function labelForParagraph(text: string, ordinal: number): string {
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  // หัวกล่อง **…** (เช่น "**เกริ่นนำ**") → ใช้ข้อความในดาว
  const bold = firstLine.match(/^\*\*(.{2,40}?)\*\*\s*$/u);
  if (bold) return bold[1].trim();
  const stripped = text.replace(/^\*+/, "").trim();
  const dash = stripped.match(/^(.{2,40}?)\s—\s/u);
  if (dash) return dash[1].trim();
  const colon = stripped.match(/^([^\n:：]{2,40}?)[：:]\s/u);
  if (colon) return colon[1].trim();
  if (/^ดิถีประจำตัวของคุณคือ/u.test(stripped)) return "ภาพดิถี";
  return `ส่วนที่ ${ordinal}`;
}

/** เรนเดอร์ inline (ตัวหนา/เน้นแดง/สี/ขนาด) — ใช้ tokenizer กลางตัวเดียวกับ PDF/docx */
function renderCardInline(text: string, keyBase: string): ReactNode[] {
  return tokenizeInline(text).map((run, i) => {
    const key = `${keyBase}-${i}`;
    const fontSize = run.fontSize;
    if (run.color) {
      return (
        <span key={key} style={{ color: run.color, fontWeight: run.bold ? 700 : undefined, fontSize }}>
          {run.text}
        </span>
      );
    }
    if (run.red) {
      return <strong key={key} className="ylc-warn" style={fontSize ? { fontSize } : undefined}>{run.text}</strong>;
    }
    if (run.bold) {
      return <strong key={key} style={fontSize ? { fontSize } : undefined}>{run.text}</strong>;
    }
    if (fontSize) return <span key={key} style={{ fontSize }}>{run.text}</span>;
    return <Fragment key={key}>{run.text}</Fragment>;
  });
}

/**
 * เรนเดอร์ "ข้อความ" (text seg หรือ เนื้อในกล่อง) เป็น block — mirror renderMarkdown ของ PDF
 * รองรับ: ย่อหน้า (บรรทัดว่างคั่น) · bullet `- ` · หัวข้อย่อย `## ` · บรรทัดเตือน `*** ` · `[[pagebreak]]`
 * → สิ่งที่ซินแสพิมพ์ (บรรทัด/บุลเลต) แสดงตรงตามที่แก้ ไม่ยุบเป็นแถวเดียว
 */
function renderTextParas(text: string, keyBase: string): ReactNode[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let k = 0;
  const flushPara = () => {
    if (!para.length) return;
    out.push(<p key={`${keyBase}-p${k++}`}>{renderCardInline(para.join(" "), `${keyBase}-pi${k}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    out.push(
      <ul key={`${keyBase}-u${k++}`} className="topic-card__box-list">
        {list.map((item, i) => (
          <li key={i}>{renderCardInline(item, `${keyBase}-li${k}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    if (line === "[[pagebreak]]") {
      flushPara();
      flushList();
      out.push(<p key={`${keyBase}-pb${k++}`} className="topic-card__pagebreak">— ขึ้นหน้าใหม่ใน PDF —</p>);
      continue;
    }
    const warn = line.match(/^\*\*\*\s*(.+?)\s*\**$/);
    if (warn && !line.startsWith("****")) {
      flushPara();
      flushList();
      out.push(<p key={`${keyBase}-w${k++}`} className="ylc-warn-line">{renderCardInline(warn[1], `${keyBase}-wi${k}`)}</p>);
      continue;
    }
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      out.push(<p key={`${keyBase}-h${k++}`} className="topic-card__box-sub">{renderCardInline(heading[1], `${keyBase}-hi${k}`)}</p>);
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
  return out;
}

/** เรนเดอร์ผลทำนายแบบอ่านอย่างเดียว (กล่องจริง + ข้อความ) — ใช้กับ "ฉบับระบบ" */
function renderReadingNodes(text: string): ReactNode[] {
  return parseReadingSegments(text).map((seg, idx) =>
    seg.kind === "text" ? (
      <Fragment key={idx}>{renderTextParas(seg.raw, `t${idx}`)}</Fragment>
    ) : (
      <section key={idx} className="ylc-box topic-card__box">
        {seg.title ? <div className="ylc-box__title">{seg.title}</div> : null}
        <div className="ylc-box__body">{renderTextParas(seg.body, `b${idx}`)}</div>
      </section>
    ),
  );
}

function RelationTable({ reading }: { reading: TopicEngineReading }) {
  if (reading.daYunTimeline) {
    return (
      <table className="topic-table">
        <thead>
          <tr>
            <th>ช่วงอายุ</th>
            <th>เสาวัยจร</th>
            <th>ราศี</th>
            <th>ปฏิกิริยา</th>
            <th>สภาวะ 12 เชี่ยงแซ</th>
          </tr>
        </thead>
        <tbody>
          {reading.daYunTimeline.map((row, index) => (
            <tr key={`${row.ageRange}-${index}`} data-current={row.isCurrent ? "true" : "false"}>
              <td>{row.ageRange}{row.isCurrent ? " ●" : ""}</td>
              <td>{row.symbol}</td>
              <td>{row.source}</td>
              <td>{row.reaction}</td>
              <td>{row.stage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reading.table.length === 0) {
    return <p className="topic-card__empty">ไม่มีแถวความสัมพันธ์ที่มองเห็นบนชั้นฟ้า/ดินสำหรับหัวข้อนี้ ให้อ่านจากวิธีการและร้อยแก้วด้านล่าง</p>;
  }

  return (
    <table className="topic-table">
      <thead>
        <tr>
          <th>อักษรจีนต้นทาง</th>
          <th>ทิศทาง / ชี้ไปที่</th>
          <th>ผลลัพธ์ความสัมพันธ์</th>
          <th>ช่วงเวลาจรที่ส่งผล</th>
        </tr>
      </thead>
      <tbody>
        {reading.table.map((row, index) => (
          <tr key={`${row.pointsTo}-${index}`}>
            <td>{row.sourceSymbol}</td>
            <td>{row.pointsTo}</td>
            <td>{row.relationResult}</td>
            <td>{row.timing}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TopicCard({
  topic,
  disabled,
  status,
  result,
  errorMessage,
  apiKey,
  onPredict,
  savedCorrection = null,
  similarCount = 0,
  onSaveCorrection,
  onClearCorrection,
  onAddRule,
  onAddRules,
}: TopicCardProps) {
  const [mode, setMode] = useState<TopicReadingMode>("engine");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  // แก้ทีละกล่อง (บทที่เป็นกล่อง): index ของ box seg ที่กำลังแก้ + ร่างเนื้อในกล่องนั้น
  const [editingBoxIdx, setEditingBoxIdx] = useState<number | null>(null);
  // แต่ละย่อหน้า ("ชิ้น" ที่ engine ประกอบ) แก้แยกกันได้ — รวมกลับเป็นกล่องเดียวตอนบันทึก
  const [boxParaDrafts, setBoxParaDrafts] = useState<string[]>([]);
  const [activeParaIdx, setActiveParaIdx] = useState(0);
  const sinsaeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const boxTextareaRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  // catalog องค์ความรู้ (lazy) — ใช้ map ว่าย่อหน้าไหนมาจากตารางไหน (best-effort; ว่าง = fallback heuristic)
  const [knowledgeTables, setKnowledgeTables] = useState<KnowledgeTableLite[]>([]);
  // precompile matcher (constant=indexOf, template=regex) ครั้งเดียวต่อ knowledgeTables
  const compiledTables = useMemo(() => compileKnowledgeTables(knowledgeTables), [knowledgeTables]);
  // สถานะแก้ catalog inline ราย entityKey ("saving" | "done" | error message)
  const [catalogEditStatus, setCatalogEditStatus] = useState<Record<string, string>>({});
  // ความรู้/กล่องที่ซินแสเพิ่มท้ายบท (append global ต่อบท) + ฟอร์มเพิ่มใหม่
  const [topicAppends, setTopicAppends] = useState<string[]>([]);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [addNoteKind, setAddNoteKind] = useState<"box" | "paragraph">("paragraph");
  const [addNoteTitle, setAddNoteTitle] = useState("");
  const [addNoteBody, setAddNoteBody] = useState("");
  const [appendStatus, setAppendStatus] = useState("");
  // ถังขยะกล่องที่เพิ่งลบ (in-memory ต่อการ์ด) — กู้คืนได้หลายชิ้น จนกว่าจะรีโหลด/ล้าง
  const [trashedBoxes, setTrashedBoxes] = useState<{ title: string; body: string }[]>([]);
  // แก้ข้อความ inline ของ text segment (บทนำ/สรุป/ย่อหน้าทั่วไป) — เก็บ index + ร่าง
  const [editingTextIdx, setEditingTextIdx] = useState<number | null>(null);
  const [textDraft, setTextDraft] = useState("");

  // ร่างกล่องทั้งก้อน = ย่อหน้าที่แก้แล้ว join กลับ (\n\n) — ใช้ตอนคำนวณ diff/บันทึก/นับกฎ
  const boxDraft = boxParaDrafts.join("\n\n");
  const setBoxParaAt = (idx: number, value: string) =>
    setBoxParaDrafts((cur) => cur.map((para, i) => (i === idx ? value : para)));

  // โหลด catalog องค์ความรู้ครั้งแรกที่ซินแสเริ่มแก้กล่อง/เพิ่มความรู้ (lazy, best-effort)
  //  - tables → ใช้ map ย่อหน้า→ตาราง
  //  - appends[topic.id] → ความรู้ที่เคยเพิ่มท้ายบท (published ∪ draft)
  const needCatalog = editingBoxIdx !== null || addNoteOpen;
  useEffect(() => {
    if (!needCatalog || knowledgeTables.length > 0) return;
    let active = true;
    void fetch("/api/reading/knowledge-override")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          body:
            | {
                tables?: KnowledgeTableLite[];
                appends?: Record<string, { published: string[]; draft: string[] }>;
              }
            | null,
        ) => {
          if (!active || !body) return;
          if (Array.isArray(body.tables)) setKnowledgeTables(body.tables);
          const ap = body.appends?.[topic.id];
          if (ap) {
            const merged = ap.draft.map((d, i) => d || ap.published[i] || "").filter((t) => t.trim());
            setTopicAppends(merged.length > 0 ? merged : ap.published.filter((t) => t.trim()));
          }
        },
      )
      .catch(() => {
        /* แก้/เพิ่มได้แม้โหลด catalog ไม่สำเร็จ */
      });
    return () => {
      active = false;
    };
  }, [needCatalog, knowledgeTables.length, topic.id]);

  // แก้ catalog inline จากกล่อง: PUT ร่าง → POST publish (มีผลทุกดวงทันที) + อัปเดต catalog ใน memory
  const publishCatalogEdit = async (tableId: string, key: string, text: string) => {
    const entityKey = knowledgeTableEntityKey(tableId, key);
    setCatalogEditStatus((cur) => ({ ...cur, [entityKey]: "saving" }));
    try {
      const headers = { "content-type": "application/json" };
      const put = await fetch("/api/reading/doctrine-draft", {
        method: "PUT",
        headers,
        body: JSON.stringify({ surface: "knowledge", entityKey, value: { text } }),
      });
      if (!put.ok) {
        const body = (await put.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new Error(body?.error?.message ?? "บันทึกร่างไม่สำเร็จ");
      }
      const pub = await fetch("/api/reading/doctrine-draft", {
        method: "POST",
        headers,
        body: JSON.stringify({ surface: "knowledge", entityKey }),
      });
      if (!pub.ok) {
        const body = (await pub.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new Error(body?.error?.message ?? "เผยแพร่ไม่สำเร็จ");
      }
      // อัปเดตค่าใน catalog ที่ถืออยู่ → ย่อหน้านี้ถือเป็น "ตรง catalog" ต่อไป (ปุ่มไม่เด้งซ้ำ)
      setKnowledgeTables((tables) =>
        tables.map((table) =>
          table.tableId === tableId
            ? {
                ...table,
                entries: table.entries.map((entry) =>
                  entry.key === key ? { ...entry, published: text, draft: null } : entry,
                ),
              }
            : table,
        ),
      );
      setCatalogEditStatus((cur) => ({ ...cur, [entityKey]: "done" }));
    } catch (error) {
      setCatalogEditStatus((cur) => ({
        ...cur,
        [entityKey]: error instanceof Error ? error.message : "ไม่สำเร็จ",
      }));
    }
  };

  // PUT ร่าง + POST publish ของช่อง knowledge (ใช้ร่วม append) — โยน error ถ้าไม่สำเร็จ
  const putAndPublishKnowledge = async (entityKey: string, text: string) => {
    const headers = { "content-type": "application/json" };
    const put = await fetch("/api/reading/doctrine-draft", {
      method: "PUT",
      headers,
      body: JSON.stringify({ surface: "knowledge", entityKey, value: { text } }),
    });
    if (!put.ok) {
      const body = (await put.json().catch(() => null)) as { error?: { message: string } } | null;
      throw new Error(body?.error?.message ?? "บันทึกร่างไม่สำเร็จ");
    }
    const pub = await fetch("/api/reading/doctrine-draft", {
      method: "POST",
      headers,
      body: JSON.stringify({ surface: "knowledge", entityKey }),
    });
    if (!pub.ok) {
      const body = (await pub.json().catch(() => null)) as { error?: { message: string } } | null;
      throw new Error(body?.error?.message ?? "เผยแพร่ไม่สำเร็จ");
    }
  };

  // (การ "เพิ่มกล่อง/ย่อหน้า" ย้ายไปเป็น per-chart ใน addSegmentPerChart — ไม่เขียนคลังกลางแล้ว)
  // ลบความรู้ที่เพิ่ม: ตั้ง text="" แล้ว publish (overlay ตัดช่องว่างทิ้งตอน render)
  const removeAppend = async (index: number) => {
    setAppendStatus("กำลังลบ…");
    try {
      await putAndPublishKnowledge(`append|${topic.id}|${index + 1}`, "");
      setTopicAppends((cur) => cur.map((t, i) => (i === index ? "" : t)));
      setAppendStatus("ลบแล้ว ✓ (กดทำนายซ้ำเพื่อดูในดวงนี้)");
    } catch (error) {
      setAppendStatus(error instanceof Error ? error.message : "ลบไม่สำเร็จ");
    }
  };

  // เครื่องมือจัดรูปแบบในกล่องแก้: ครอบข้อความที่เลือกด้วย marker inline (**หนา** / ***แดง*** /
  // [[c=..]] / [[s=..]]) — ไวยากรณ์เดียวกับ PDF/Word/การ์ด (tokenizer กลาง) จึงเห็นผลตรงกันทุกที่
  const wrapBoxSelection = (before: string, after: string) => {
    const idx = activeParaIdx;
    const el = boxTextareaRefs.current[idx];
    const current = boxParaDrafts[idx] ?? "";
    if (!el) return;
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const selected = current.slice(start, end) || "ข้อความ";
    const next = `${current.slice(0, start)}${before}${selected}${after}${current.slice(end)}`;
    setBoxParaAt(idx, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  // แทรกตัวแบ่งหน้า ([[pagebreak]]) ที่ตำแหน่ง cursor ของ textarea — ดูผลใน preview ก่อนทำ PDF
  const insertPageBreak = () => {
    const el = sinsaeTextareaRef.current;
    const marker = "\n\n[[pagebreak]]\n\n";
    if (!el) {
      setDraft((cur) => `${cur}${marker}`);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${marker}${draft.slice(end)}`;
    setDraft(next);
    requestAnimationFrame(() => {
      const pos = start + marker.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const statusTone = status === "loading" ? "busy" : status === "done" ? "ready" : status === "error" ? "error" : "idle";
  const statusLabel = status === "loading" ? "กำลังทำนาย" : status === "done" ? "ทำนายแล้ว" : status === "error" ? "ผิดพลาด" : "ยังไม่ทำนาย";

  return (
    <Surface as="article" className="topic-card" id={`topic-${topic.id}`}>
      <header className="topic-card__head">
        <div>
          <p className="section-kicker">{topic.chapter === 0 ? "ฐานคำนวณ" : `บทที่ ${topic.chapter}`}</p>
          <h3>{topic.title}</h3>
          <p className="section-note">{topic.lens}</p>
        </div>
        <StatusChip tone={statusTone}>{statusLabel}</StatusChip>
      </header>

      {topic.kind === "predict" && (
        <div className="topic-card__controls">
          <div className="topic-card__mode" role="group" aria-label="โหมดทำนาย">
            <button
              type="button"
              className={mode === "engine" ? "mode-pill mode-pill--active" : "mode-pill"}
              aria-pressed={mode === "engine"}
              onClick={() => setMode("engine")}
            >
              Engine (จาก DB ตรงๆ)
            </button>
            <button
              type="button"
              className={mode === "llm" ? "mode-pill mode-pill--active" : "mode-pill"}
              aria-pressed={mode === "llm"}
              onClick={() => setMode("llm")}
            >
              LLM (เรียบเรียงเป็นธรรมชาติ)
            </button>
          </div>

          <ActionButton
            tone="primary"
            type="button"
            disabled={disabled || status === "loading" || (mode === "llm" && apiKey.trim().length === 0)}
            onClick={() => onPredict(topic.id, mode, mode === "llm" ? apiKey.trim() : null)}
          >
            {status === "loading" ? "กำลังทำนาย..." : status === "done" ? "ทำนายซ้ำ" : "ทำนายหัวข้อนี้"}
          </ActionButton>
          {mode === "llm" && apiKey.trim().length === 0 && (
            <span className="topic-card__hint">ใส่ API key ในช่องด้านบนก่อน</span>
          )}
        </div>
      )}

      {errorMessage && <p className="topic-card__error" role="alert">{errorMessage}</p>}

      {result && (
        <div className="topic-card__result">
          <CollapsibleBlock
            title={result.reading.daYunTimeline ? "ตารางวัยจรเชิงลึก (ช่วงละ 5 ปี)" : "ตารางความสัมพันธ์"}
          >
            <RelationTable reading={result.reading} />
          </CollapsibleBlock>

          {result.reading.method.length > 0 && (
            <CollapsibleBlock title="วิธีการอ่าน">
              <ul>
                {result.reading.method.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </CollapsibleBlock>
          )}

          <CollapsibleBlock
            title="คำอ่าน"
            source={
              result.knownlageExcerpt && result.knownlageExcerpt.length > 0
                ? "จากตำรา (knownlage)"
                : "จาก engine truth"
            }
          >
            {(result.knownlageExcerpt && result.knownlageExcerpt.length > 0
              ? result.knownlageExcerpt
              : result.reading.prose
            ).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </CollapsibleBlock>

          {(() => {
            const systemText = result.humanReading ?? "";
            const displayText = savedCorrection ? savedCorrection.corrected : systemText;
            const canEdit = Boolean(onSaveCorrection);
            const segments = parseReadingSegments(displayText);
            const hasBoxes = segments.some((seg) => seg.kind === "box");
            const saveBox = (segIdx: number, systemBody: string) => {
              // ทุกบรรทัดที่ซินแสกด Enter = ย่อหน้าใหม่ (กันถูกยุบรวมเป็นแถวเดียวตอนเรนเดอร์ markdown)
              const normalizedBody = normalizeBoxBody(boxDraft);
              const rebuilt = serializeReadingSegments(
                segments.map((seg, i) =>
                  i === segIdx && seg.kind === "box" ? { ...seg, body: normalizedBody } : seg,
                ),
              );
              // (1) คงผลรายดวง (correction ของดวงนี้)
              onSaveCorrection?.(topic.id, rebuilt);
              // (2) กระจายข้ามดวง: diff เฉพาะ "กล่องนี้" (ฉบับระบบ vs ฉบับแก้) → สร้างกฎแทนคำ (scope=topic)
              //     อัตโนมัติ เพื่อให้ดวงอื่นที่ทายบทเดียวกันได้วลีเดิม ออกเป็นวลีที่ซินแสแก้
              if (onAddRules && systemBody && normalizedBody !== systemBody) {
                const pairs = suggestSubstitutions(systemBody, normalizedBody).filter(
                  (pair) => pair.match.trim().length > 0,
                );
                if (pairs.length > 0) {
                  void onAddRules(
                    pairs.map((pair) => ({
                      scope: "topic" as const,
                      topicId: topic.id,
                      match: pair.match,
                      replacement: pair.replacement,
                    })),
                  );
                }
              }
              setEditingBoxIdx(null);
            };
            // ลบทั้งกล่อง (เฉพาะดวงนี้): ตัด box seg นี้ออกแล้วบันทึกเป็น correction ของดวงนี้
            // ไม่สร้างกฎข้ามดวง — ดวงอื่นในบทเดียวกันยังเห็นกล่องนี้ตามเดิม (เรียกคืนด้วย "ล้างการแก้ไข")
            const deleteBox = (segIdx: number, boxTitle: string) => {
              if (typeof window !== "undefined") {
                const ok = window.confirm(
                  `ลบกล่อง “${boxTitle || "ไม่มีหัวข้อ"}” ทั้งกล่อง?\nมีผลเฉพาะดวงนี้ — กด “ล้างการแก้ไข (กลับใช้ของระบบ)” เพื่อเรียกคืน`,
                );
                if (!ok) return;
              }
              // เก็บกล่องที่ลบลงถังขยะก่อน (กู้คืนได้ภายหลัง จนกว่าจะรีโหลด/ล้าง)
              const removed = segments[segIdx];
              if (removed?.kind === "box") {
                setTrashedBoxes((cur) => [{ title: removed.title, body: removed.body }, ...cur]);
              }
              const rebuilt = serializeReadingSegments(segments.filter((_, i) => i !== segIdx));
              onSaveCorrection?.(topic.id, rebuilt);
              if (editingBoxIdx === segIdx) setEditingBoxIdx(null);
            };
            // กู้คืนกล่องจากถังขยะ — ต่อท้ายบท (ย้ายตำแหน่งต่อด้วยปุ่ม ▲/▼ ได้) แล้วเอาออกจากถัง
            const restoreTrashedBox = (trashIdx: number) => {
              const item = trashedBoxes[trashIdx];
              if (!item) return;
              const rebuilt = serializeReadingSegments([
                ...segments,
                { kind: "box", title: item.title, body: item.body },
              ]);
              onSaveCorrection?.(topic.id, rebuilt);
              setTrashedBoxes((cur) => cur.filter((_, i) => i !== trashIdx));
            };
            // ย้ายชิ้น (กล่อง/ย่อหน้า) ขึ้น/ลง — สลับกับเพื่อนบ้าน แล้วบันทึกเป็น correction เฉพาะดวงนี้
            const moveSegment = (segIdx: number, dir: -1 | 1) => {
              const target = segIdx + dir;
              if (target < 0 || target >= segments.length) return;
              const next = segments.slice();
              [next[segIdx], next[target]] = [next[target], next[segIdx]];
              onSaveCorrection?.(topic.id, serializeReadingSegments(next));
              // sync สถานะ "กำลังแก้กล่องนี้" ให้เลื่อนตามชิ้นที่ย้าย
              if (editingBoxIdx === segIdx) setEditingBoxIdx(target);
              else if (editingBoxIdx === target) setEditingBoxIdx(segIdx);
            };
            // แก้ข้อความ text segment (บทนำ/สรุป/ย่อหน้า) inline — แทนที่ raw แล้วบันทึกเป็น correction เฉพาะดวงนี้
            const saveTextSegment = (segIdx: number) => {
              const body = normalizeBoxBody(textDraft);
              if (!body) return;
              const rebuilt = serializeReadingSegments(
                segments.map((seg, i) => (i === segIdx && seg.kind === "text" ? { kind: "text", raw: body } : seg)),
              );
              onSaveCorrection?.(topic.id, rebuilt);
              setEditingTextIdx(null);
            };
            // เพิ่มกล่อง/ย่อหน้าใหม่ "เฉพาะดวงนี้": ต่อ segment ใหม่ท้ายผลทำนายแล้วบันทึกเป็น correction ของดวงนี้
            // (ไม่เขียนคลังกลาง → ไม่มีผลทุกดวง) ผลไหลเข้า displayText เดียวกับการ์ด/PDF จึงตรงกันทุกที่
            const addSegmentPerChart = () => {
              const rawBody = addNoteBody.trim();
              if (rawBody.length === 0) return;
              const title = addNoteTitle.trim();
              if (addNoteKind === "box" && title.length === 0) {
                setAppendStatus("กล่องใหม่ต้องมีชื่อหัวข้อ");
                return;
              }
              const body = normalizeBoxBody(rawBody);
              const newSeg: ReadingSegment =
                addNoteKind === "box"
                  ? { kind: "box", title, body: `**${title}**\n\n${body}` }
                  : { kind: "text", raw: body };
              const rebuilt = serializeReadingSegments([...segments, newSeg]);
              onSaveCorrection?.(topic.id, rebuilt);
              setAddNoteTitle("");
              setAddNoteBody("");
              setAddNoteOpen(false);
              setAppendStatus("เพิ่มแล้ว ✓ (เฉพาะดวงนี้)");
            };
            // body ฉบับระบบ (ก่อนซินแสแก้) ของแต่ละกล่อง — ใช้ diff กับ body ปัจจุบันเพื่อเสนอกฎแทนคำต่อกล่อง
            const systemBoxBody = new Map<string, string>();
            if (hasBoxes) {
              for (const seg of parseReadingSegments(systemText)) {
                if (seg.kind === "box") systemBoxBody.set(seg.title, seg.body);
              }
            }
            return (
              <section className="topic-card__block topic-card__human">
                <h4>
                  ผลการทำนาย
                  <span className="topic-card__source">
                    {savedCorrection
                      ? "แก้ไขโดยซินแส"
                      : result.source === "llm"
                        ? `เรียบเรียงโดย LLM (${result.model})`
                        : "จาก knownlage"}
                  </span>
                </h4>
                {displayText
                  ? segments.map((seg, segIdx) => {
                      if (seg.kind === "text") {
                        if (editingTextIdx === segIdx) {
                          return (
                            <div key={segIdx} className="topic-card__para-block topic-card__para-block--editing">
                              <textarea
                                className="topic-card__sinsae-textarea"
                                value={textDraft}
                                rows={Math.min(16, Math.max(3, textDraft.split("\n").length + 1))}
                                onChange={(event) => setTextDraft(event.target.value)}
                              />
                              <div className="topic-card__para-edit-actions">
                                <button
                                  type="button"
                                  className="topic-card__box-edit"
                                  onClick={() => saveTextSegment(segIdx)}
                                >
                                  💾 บันทึก
                                </button>
                                <button
                                  type="button"
                                  className="topic-card__box-edit"
                                  onClick={() => setEditingTextIdx(null)}
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={segIdx} className="topic-card__para-block">
                            {renderTextParas(seg.raw, `t${segIdx}`)}
                            {canEdit && (
                              <div className="topic-card__para-actions">
                                <button
                                  type="button"
                                  className="topic-card__box-move topic-card__para-edit-btn"
                                  title="แก้ข้อความนี้"
                                  onClick={() => {
                                    setEditingTextIdx(segIdx);
                                    setTextDraft(seg.raw);
                                  }}
                                >
                                  ✎ แก้
                                </button>
                                <button
                                  type="button"
                                  className="topic-card__box-move"
                                  title="ย้ายขึ้น"
                                  disabled={segIdx === 0}
                                  onClick={() => moveSegment(segIdx, -1)}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="topic-card__box-move"
                                  title="ย้ายลง"
                                  disabled={segIdx === segments.length - 1}
                                  onClick={() => moveSegment(segIdx, 1)}
                                >
                                  ▼
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      }
                      // กล่อง: แก้ทีละกล่อง — กดปุ่มที่กล่องนั้นเพื่อแก้เฉพาะเนื้อในกล่องนั้น
                      if (editingBoxIdx === segIdx) {
                        const editSystemBody = seg.kind === "box" ? systemBoxBody.get(seg.title) ?? "" : "";
                        // ย่อหน้าฉบับระบบ (เทียบหาว่าชิ้นไหนถูกแก้) + ธงแก้แล้วราย sub-textarea
                        const systemParas = splitBoxParagraphs(editSystemBody);
                        const editedFlags = boxParaDrafts.map(
                          (para, i) => systemParas[i] === undefined || systemParas[i] !== para.trim(),
                        );
                        const anyEdited = editedFlags.some(Boolean);
                        const multiPara = boxParaDrafts.length > 1;
                        // ผลกระทบข้ามดวง: จำนวนกฎแทนคำที่จะเกิดเมื่อบันทึก (เฉพาะบทนี้)
                        const pendingRuleCount = editSystemBody
                          ? suggestSubstitutions(editSystemBody, normalizeBoxBody(boxDraft)).filter(
                              (pair) => pair.match.trim().length > 0,
                            ).length
                          : 0;
                        return (
                          <div key={segIdx} className="ylc-box topic-card__box topic-card__box--editing">
                            <div className="ylc-box__title">{seg.title}</div>
                            <div className="topic-card__box-toolbar" role="toolbar" aria-label="เครื่องมือจัดรูปแบบ">
                              <button
                                type="button"
                                className="topic-card__box-tool"
                                title="ตัวหนา (**ข้อความ**)"
                                onClick={() => wrapBoxSelection("**", "**")}
                              >
                                <strong>B</strong> ตัวหนา
                              </button>
                              <button
                                type="button"
                                className="topic-card__box-tool"
                                title="เน้นแดง (***ข้อความ***)"
                                onClick={() => wrapBoxSelection("***", "***")}
                              >
                                <strong className="ylc-warn">A</strong> เน้นแดง
                              </button>
                              <select
                                className="topic-card__box-tool"
                                value=""
                                title="สีตัวอักษร ([[c=สี]]…[[/c]])"
                                onChange={(event) => {
                                  if (event.target.value) {
                                    wrapBoxSelection(`[[c=${event.target.value}]]`, "[[/c]]");
                                  }
                                }}
                              >
                                <option value="">สี…</option>
                                {READING_COLORS.map((color) => (
                                  <option key={color.key} value={color.key}>
                                    {color.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                className="topic-card__box-tool"
                                value=""
                                title="ขนาดตัวอักษร ([[s=พอยต์]]…[[/s]])"
                                onChange={(event) => {
                                  if (event.target.value) {
                                    wrapBoxSelection(`[[s=${event.target.value}]]`, "[[/s]]");
                                  }
                                }}
                              >
                                <option value="">ขนาด…</option>
                                {[12, 14, 16, 18, 20, 24].map((pt) => (
                                  <option key={pt} value={pt}>
                                    {pt} pt
                                  </option>
                                ))}
                              </select>
                            </div>
                            {boxParaDrafts.map((para, pIdx) => {
                              const sources = resolveParagraphSources(para, compiledTables);
                              // ชิ้น exact = ย่อหน้าตรงค่าช่องเดียวเป๊ะ → แก้ inline ได้; ไม่งั้นเป็นแค่ "ส่วนประกอบ"
                              const exactSource = sources.find((s) => s.exact) ?? null;
                              const canCatalogEdit = Boolean(exactSource && editedFlags[pIdx]);
                              const entityKey = exactSource
                                ? knowledgeTableEntityKey(exactSource.tableId, exactSource.key)
                                : "";
                              const catStatus = entityKey ? catalogEditStatus[entityKey] : undefined;
                              return (
                                <div
                                  key={pIdx}
                                  className={`topic-card__box-para${
                                    activeParaIdx === pIdx ? " topic-card__box-para--active" : ""
                                  }`}
                                >
                                  {multiPara && (
                                    <div className="topic-card__box-para-head">
                                      <span className="topic-card__box-para-label">
                                        {labelForParagraph(para, pIdx + 1)}
                                      </span>
                                      {sources.map((s) => (
                                        <a
                                          key={`${s.tableId}|${s.key}`}
                                          className="topic-card__box-para-source"
                                          href={`/reading/knowledge?tab=condition&table=${encodeURIComponent(
                                            s.tableId,
                                          )}&key=${encodeURIComponent(s.key)}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          title={
                                            s.exact
                                              ? `ทั้งย่อหน้านี้มาจากตาราง ${s.tableId} — เปิดช่องนี้ในคลัง`
                                              : s.full
                                                ? `ทั้งย่อหน้านี้สร้างจากเทมเพลต ${s.tableId} — เปิดแก้โครงประโยคในคลัง (แก้ทุกดวง)`
                                                : `บางส่วนของย่อหน้านี้มาจากตาราง ${s.tableId} ("${s.value}") — เปิดช่องนี้ในคลัง`
                                          }
                                        >
                                          📚 {s.full && !s.exact ? s.keyLabel : s.label}
                                          {s.full ? "" : " (บางส่วน)"} · ✎ แก้ในคลัง
                                        </a>
                                      ))}
                                      {editedFlags[pIdx] && (
                                        <span className="topic-card__box-guide-edited">✎ แก้แล้ว</span>
                                      )}
                                      {canCatalogEdit && catStatus !== "done" && exactSource && (
                                        <button
                                          type="button"
                                          className="topic-card__box-para-catalog"
                                          disabled={catStatus === "saving"}
                                          title="อัปเดตค่าต้นทางในคลังความรู้ — มีผลทุกดวง"
                                          onClick={() =>
                                            void publishCatalogEdit(exactSource.tableId, exactSource.key, para.trim())
                                          }
                                        >
                                          {catStatus === "saving" ? "กำลังบันทึก…" : "💾 แก้ในคลัง (ทุกดวง)"}
                                        </button>
                                      )}
                                      {catStatus === "done" && (
                                        <span className="topic-card__box-para-catalog-done">
                                          อัปเดตคลังแล้ว ✓ มีผลทุกดวง
                                        </span>
                                      )}
                                      {catStatus && catStatus !== "saving" && catStatus !== "done" && (
                                        <span className="topic-card__box-para-catalog-err">{catStatus}</span>
                                      )}
                                      {boxParaDrafts.length > 1 && (
                                        <button
                                          type="button"
                                          className="topic-card__sinsae-link topic-card__sinsae-link--danger"
                                          title="ลบชิ้นนี้ออกจากกล่อง (เฉพาะดวงนี้)"
                                          onClick={() =>
                                            setBoxParaDrafts((cur) => cur.filter((_, i) => i !== pIdx))
                                          }
                                        >
                                          ลบชิ้น
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  <textarea
                                    ref={(el) => {
                                      boxTextareaRefs.current[pIdx] = el;
                                    }}
                                    className="topic-card__sinsae-textarea"
                                    value={para}
                                    rows={Math.min(12, Math.max(2, para.split("\n").length + 1))}
                                    onFocus={() => setActiveParaIdx(pIdx)}
                                    onChange={(event) => setBoxParaAt(pIdx, event.target.value)}
                                  />
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              className="topic-card__box-add-para"
                              onClick={() => {
                                setBoxParaDrafts((cur) => [...cur, ""]);
                                setActiveParaIdx(boxParaDrafts.length);
                              }}
                            >
                              ＋ เพิ่มชิ้นย่อยในหัวข้อนี้
                            </button>
                            {anyEdited && (
                              <p className="topic-card__box-impact">
                                {pendingRuleCount > 0 ? (
                                  <>
                                    บันทึกแล้วจะสร้าง<strong> กฎแทนคำ {pendingRuleCount} รายการ</strong> (เฉพาะบทนี้) —
                                    ดวงอื่นที่ทายได้วลีเดิมจะเปลี่ยนตาม
                                  </>
                                ) : (
                                  <>การแก้นี้มีผลเฉพาะดวงนี้ (ไม่สร้างกฎข้ามดวง)</>
                                )}
                              </p>
                            )}
                            <div className="topic-card__sinsae-actions">
                              <ActionButton
                                tone="primary"
                                type="button"
                                disabled={boxDraft.trim().length === 0}
                                onClick={() =>
                                  saveBox(segIdx, seg.kind === "box" ? systemBoxBody.get(seg.title) ?? "" : "")
                                }
                              >
                                บันทึกกล่องนี้
                              </ActionButton>
                              <button
                                type="button"
                                className="topic-card__sinsae-link"
                                onClick={() => setEditingBoxIdx(null)}
                              >
                                ยกเลิก
                              </button>
                              <button
                                type="button"
                                className="topic-card__sinsae-link topic-card__sinsae-link--danger"
                                title="ลบทั้งกล่องนี้ออกจากดวงนี้ (เรียกคืนได้)"
                                onClick={() => deleteBox(segIdx, seg.kind === "box" ? seg.title : "")}
                              >
                                🗑 ลบทั้งกล่อง
                              </button>
                            </div>
                          </div>
                        );
                      }
                      {
                        const sysBody = systemBoxBody.get(seg.title) ?? "";
                        const boxCorrected = sysBody && seg.body !== sysBody ? seg.body : null;
                        return (
                          <section key={segIdx} className="ylc-box topic-card__box">
                            {seg.title ? <div className="ylc-box__title">{seg.title}</div> : null}
                            <div className="ylc-box__body">{renderTextParas(seg.body, `b${segIdx}`)}</div>
                            {canEdit && (
                              <div className="topic-card__box-actions">
                                <button
                                  type="button"
                                  className="topic-card__box-edit topic-card__box-move"
                                  title="ย้ายขึ้น"
                                  disabled={segIdx === 0}
                                  onClick={() => moveSegment(segIdx, -1)}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="topic-card__box-edit topic-card__box-move"
                                  title="ย้ายลง"
                                  disabled={segIdx === segments.length - 1}
                                  onClick={() => moveSegment(segIdx, 1)}
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  className="topic-card__box-edit"
                                  onClick={() => {
                                    setEditingBoxIdx(segIdx);
                                    const paras = splitBoxParagraphs(seg.body);
                                    setBoxParaDrafts(paras.length > 0 ? paras : [seg.body]);
                                    setActiveParaIdx(0);
                                    boxTextareaRefs.current = [];
                                  }}
                                >
                                  ✎ แก้กล่องนี้
                                </button>
                                <button
                                  type="button"
                                  className="topic-card__box-edit topic-card__box-edit--danger"
                                  title="ลบทั้งกล่องนี้ออกจากดวงนี้ (เรียกคืนได้)"
                                  onClick={() => deleteBox(segIdx, seg.title)}
                                >
                                  🗑 ลบทั้งกล่อง
                                </button>
                              </div>
                            )}
                            {onAddRule && sysBody && (
                              <CollapsibleBlock
                                title="🔧 กฎแทนคำ (จากกล่องนี้)"
                                defaultOpen={Boolean(boxCorrected)}
                                className="topic-card__box-rules"
                                source={boxCorrected ? "มีคำที่แก้" : undefined}
                              >
                                <SinsaeRuleBuilder
                                  topicId={topic.id}
                                  systemText={sysBody}
                                  correctedText={boxCorrected}
                                  onAddRule={onAddRule}
                                  onAddRules={onAddRules}
                                />
                              </CollapsibleBlock>
                            )}
                          </section>
                        );
                      }
                    })
                  : (
                    <p className="topic-card__empty">
                      ยังไม่มีองค์ความรู้ภาษามนุษย์สำหรับหัวข้อนี้ (รอ ingest จาก docx ใน knownlage)
                    </p>
                  )}
                {result.sourceLabel && (
                  <p className="topic-card__citation">อ้างอิง: {result.sourceLabel}</p>
                )}

                {canEdit && trashedBoxes.length > 0 && (
                  <CollapsibleBlock
                    title={`🗑 ถังขยะ (${trashedBoxes.length})`}
                    className="topic-card__trash"
                    defaultOpen
                    source="กล่องที่ลบ — กู้คืนได้"
                  >
                    <ul className="topic-card__trash-list">
                      {trashedBoxes.map((item, trashIdx) => (
                        <li key={trashIdx} className="topic-card__trash-item">
                          <span className="topic-card__trash-title">
                            {item.title || "ไม่มีหัวข้อ"}
                          </span>
                          <button
                            type="button"
                            className="topic-card__box-edit"
                            title="กู้กล่องนี้กลับเข้าบท (ต่อท้าย — ย้ายตำแหน่งด้วย ▲/▼ ได้)"
                            onClick={() => restoreTrashedBox(trashIdx)}
                          >
                            ↩ กู้คืน
                          </button>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleBlock>
                )}

                {savedCorrection && showSystem && (
                  <div className="topic-card__system-version">
                    <p className="topic-card__system-version-label">ฉบับระบบ (ก่อนซินแสแก้)</p>
                    {systemText ? renderReadingNodes(systemText) : <p className="topic-card__empty">—</p>}
                  </div>
                )}

                {canEdit && (
                  <div className="topic-card__sinsae">
                    {!editing ? (
                      <div className="topic-card__sinsae-actions">
                        {/* บทที่เป็นกล่อง = แก้ทีละกล่อง (ปุ่มอยู่ในแต่ละกล่องแล้ว) ไม่ต้องมีปุ่มแก้รวม */}
                        {!hasBoxes && (
                          <button
                            type="button"
                            className="topic-card__sinsae-toggle"
                            onClick={() => {
                              setDraft(displayText);
                              setEditing(true);
                            }}
                          >
                            ✎ แก้ไขโดยซินแส
                          </button>
                        )}
                        {hasBoxes && (
                          <span className="topic-card__sinsae-hint">
                            แก้ได้ทีละกล่อง — กด “✎ แก้กล่องนี้” ที่กล่องที่ต้องการ
                          </span>
                        )}
                        {savedCorrection && (
                          <>
                            <button
                              type="button"
                              className="topic-card__sinsae-link"
                              onClick={() => setShowSystem((value) => !value)}
                            >
                              {showSystem ? "ซ่อนฉบับระบบ" : "ดูฉบับระบบ"}
                            </button>
                            <button
                              type="button"
                              className="topic-card__sinsae-link topic-card__sinsae-link--danger"
                              onClick={() => {
                                onClearCorrection?.(topic.id);
                                setShowSystem(false);
                              }}
                            >
                              ล้างการแก้ไข (กลับใช้ของระบบ)
                            </button>
                          </>
                        )}
                        {!savedCorrection && similarCount > 0 && (
                          <span className="topic-card__sinsae-hint">
                            มีคำที่ซินแสเคยแก้ดวงคล้ายกัน {similarCount} รายการ — ทำนายซ้ำโหมด LLM เพื่อนำมาใช้
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="topic-card__sinsae-editor">
                        <label className="topic-card__sinsae-label" htmlFor={`sinsae-${topic.id}`}>
                          แก้คำทำนายให้เป็นฉบับซินแส (บันทึกไว้ในเครื่อง · นำไปใช้ override และป้อนกลับให้ LLM)
                        </label>
                        <textarea
                          id={`sinsae-${topic.id}`}
                          ref={sinsaeTextareaRef}
                          className="topic-card__sinsae-textarea"
                          value={draft}
                          rows={Math.min(20, Math.max(6, draft.split("\n").length + 1))}
                          onChange={(event) => setDraft(event.target.value)}
                        />
                        <div className="topic-card__sinsae-actions">
                          <ActionButton
                            tone="primary"
                            type="button"
                            disabled={draft.trim().length === 0}
                            onClick={() => {
                              onSaveCorrection?.(topic.id, draft);
                              setEditing(false);
                            }}
                          >
                            บันทึกการแก้ไข
                          </ActionButton>
                          <button
                            type="button"
                            className="topic-card__sinsae-link"
                            onClick={insertPageBreak}
                            title="แทรกจุดขึ้นหน้าใหม่ตรงตำแหน่งเคอร์เซอร์ — ดูผลใน 'ดูตัวอย่าง & บันทึก PDF'"
                          >
                            ⤓ แทรกตัวแบ่งหน้า
                          </button>
                          <button
                            type="button"
                            className="topic-card__sinsae-link"
                            onClick={() => setEditing(false)}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    )}
                    {/* บทที่เป็นกล่อง = กฎแทนคำอยู่ในแต่ละกล่องแล้ว (ไม่ต้องมีตัวรวมทั้งบท) */}
                    {!hasBoxes && !editing && onAddRule && systemText && (
                      <SinsaeRuleBuilder
                        topicId={topic.id}
                        systemText={systemText}
                        correctedText={savedCorrection?.corrected ?? null}
                        onAddRule={onAddRule}
                        onAddRules={onAddRules}
                      />
                    )}

                    {/* เพิ่มกล่อง/ย่อหน้าใหม่ท้ายบท "เฉพาะดวงนี้" (บันทึกเป็น correction — ไหลเข้าการ์ด/PDF เหมือนกัน) */}
                    {!editing && (
                      <div className="topic-card__add-note">
                        {topicAppends.filter((t) => t.trim()).length > 0 && (
                          <ul className="topic-card__add-note-list">
                            <li className="topic-card__add-note-caption">
                              ความรู้ที่เคยเพิ่มแบบ “ทุกดวง” (เดิม) — กดลบเพื่อเอาออกจากทุกดวง
                            </li>
                            {topicAppends.map((text, i) =>
                              text.trim() ? (
                                <li key={i} className="topic-card__add-note-item">
                                  <span className="topic-card__add-note-text">
                                    {text.startsWith("[[box=")
                                      ? `📦 ${text.match(/\[\[box=(.*?)\]\]/)?.[1] ?? "กล่อง"}`
                                      : text.length > 60
                                        ? `${text.slice(0, 60)}…`
                                        : text}
                                  </span>
                                  <button
                                    type="button"
                                    className="topic-card__sinsae-link topic-card__sinsae-link--danger"
                                    onClick={() => void removeAppend(i)}
                                  >
                                    ลบ
                                  </button>
                                </li>
                              ) : null,
                            )}
                          </ul>
                        )}
                        {!addNoteOpen ? (
                          <button
                            type="button"
                            className="topic-card__sinsae-toggle"
                            onClick={() => {
                              setAddNoteOpen(true);
                              setAppendStatus("");
                            }}
                          >
                            ＋ เพิ่มกล่อง/ย่อหน้าใหม่ (เฉพาะดวงนี้)
                          </button>
                        ) : (
                          <div className="topic-card__add-note-form">
                            <div className="topic-card__add-note-kind" role="group" aria-label="ชนิด">
                              <label>
                                <input
                                  type="radio"
                                  name={`addkind-${topic.id}`}
                                  checked={addNoteKind === "paragraph"}
                                  onChange={() => setAddNoteKind("paragraph")}
                                />{" "}
                                ย่อหน้า
                              </label>
                              <label>
                                <input
                                  type="radio"
                                  name={`addkind-${topic.id}`}
                                  checked={addNoteKind === "box"}
                                  onChange={() => setAddNoteKind("box")}
                                />{" "}
                                กล่อง (มีหัวข้อ)
                              </label>
                            </div>
                            {addNoteKind === "box" && (
                              <input
                                className="topic-card__add-note-title"
                                placeholder="ชื่อหัวข้อกล่อง"
                                value={addNoteTitle}
                                onChange={(e) => setAddNoteTitle(e.target.value)}
                              />
                            )}
                            <textarea
                              className="topic-card__sinsae-textarea"
                              placeholder="พิมพ์เนื้อความที่จะต่อท้ายบทนี้ (เฉพาะดวงนี้)…"
                              value={addNoteBody}
                              rows={4}
                              onChange={(e) => setAddNoteBody(e.target.value)}
                            />
                            <div className="topic-card__sinsae-actions">
                              <ActionButton
                                tone="primary"
                                type="button"
                                disabled={addNoteBody.trim().length === 0}
                                onClick={() => addSegmentPerChart()}
                              >
                                เพิ่ม (เฉพาะดวงนี้)
                              </ActionButton>
                              <button
                                type="button"
                                className="topic-card__sinsae-link"
                                onClick={() => setAddNoteOpen(false)}
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        )}
                        {appendStatus && (
                          <p className="topic-card__add-note-status">{appendStatus}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })()}
        </div>
      )}

      {topic.kind === "basis" && !result && (
        <p className="section-note">กดคำนวณดวงด้านบนเพื่อแสดงฐานคำนวณ</p>
      )}
    </Surface>
  );
}
