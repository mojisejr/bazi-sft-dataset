"use client";

import { useRef, useState, type ReactNode } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { StatusChip } from "@/components/bazi/primitives/StatusChip";
import { Surface } from "@/components/bazi/primitives/Surface";
import { SinsaeRuleBuilder, type AddRuleInput } from "@/components/bazi/reading/SinsaeRuleBuilder";
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
                  ? displayText.split("\n\n").map((paragraph, index) =>
                      paragraph.trim() === "[[pagebreak]]" ? (
                        <p key={index} className="topic-card__pagebreak">— ขึ้นหน้าใหม่ใน PDF —</p>
                      ) : (
                        <p key={index}>{paragraph}</p>
                      ),
                    )
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
                    {systemText
                      ? systemText.split("\n\n").map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))
                      : <p className="topic-card__empty">—</p>}
                  </div>
                )}

                {canEdit && (
                  <div className="topic-card__sinsae">
                    {!editing ? (
                      <div className="topic-card__sinsae-actions">
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
                    {!editing && onAddRule && systemText && (
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
