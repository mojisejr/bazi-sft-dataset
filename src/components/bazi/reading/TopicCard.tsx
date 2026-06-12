"use client";

import { Fragment, useRef, useState, type ReactNode } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { StatusChip } from "@/components/bazi/primitives/StatusChip";
import { Surface } from "@/components/bazi/primitives/Surface";
import { SinsaeRuleBuilder, type AddRuleInput } from "@/components/bazi/reading/SinsaeRuleBuilder";
import { tokenizeInline } from "@/lib/bazi/reading-inline";
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
  const [boxDraft, setBoxDraft] = useState("");
  const sinsaeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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
            const saveBox = (segIdx: number) => {
              // ทุกบรรทัดที่ซินแสกด Enter = ย่อหน้าใหม่ (กันถูกยุบรวมเป็นแถวเดียวตอนเรนเดอร์ markdown)
              const normalizedBody = normalizeBoxBody(boxDraft);
              const rebuilt = serializeReadingSegments(
                segments.map((seg, i) =>
                  i === segIdx && seg.kind === "box" ? { ...seg, body: normalizedBody } : seg,
                ),
              );
              onSaveCorrection?.(topic.id, rebuilt);
              setEditingBoxIdx(null);
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
                        return <Fragment key={segIdx}>{renderTextParas(seg.raw, `t${segIdx}`)}</Fragment>;
                      }
                      // กล่อง: แก้ทีละกล่อง — กดปุ่มที่กล่องนั้นเพื่อแก้เฉพาะเนื้อในกล่องนั้น
                      if (editingBoxIdx === segIdx) {
                        return (
                          <div key={segIdx} className="ylc-box topic-card__box topic-card__box--editing">
                            <div className="ylc-box__title">{seg.title}</div>
                            <textarea
                              className="topic-card__sinsae-textarea"
                              value={boxDraft}
                              rows={Math.min(16, Math.max(4, boxDraft.split("\n").length + 1))}
                              onChange={(event) => setBoxDraft(event.target.value)}
                            />
                            <div className="topic-card__sinsae-actions">
                              <ActionButton
                                tone="primary"
                                type="button"
                                disabled={boxDraft.trim().length === 0}
                                onClick={() => saveBox(segIdx)}
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
                              <button
                                type="button"
                                className="topic-card__box-edit"
                                onClick={() => {
                                  setEditingBoxIdx(segIdx);
                                  setBoxDraft(seg.body);
                                }}
                              >
                                ✎ แก้กล่องนี้
                              </button>
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
