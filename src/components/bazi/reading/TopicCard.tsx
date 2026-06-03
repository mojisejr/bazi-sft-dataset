"use client";

import { useState } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { StatusChip } from "@/components/bazi/primitives/StatusChip";
import { Surface } from "@/components/bazi/primitives/Surface";
import type { TopicDefinition, TopicEngineReading } from "@/lib/bazi/topic-reading";

export type TopicReadingMode = "engine" | "llm";

export type RelationshipLineRow = {
  ageRange: string;
  symbol: string;
  relationLine: string;
  deepNote: string;
};

export type TopicReadingResult = {
  source: "engine" | "llm";
  model?: string;
  reading: TopicEngineReading;
  /** ผลการทำนายภาษามนุษย์ (engine = จาก knownlage, llm = ขัดเกลา) — null ถ้ายังไม่มีองค์ความรู้ */
  humanReading?: string | null;
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
};

function RelationTable({ reading }: { reading: TopicEngineReading }) {
  if (reading.daYunTimeline) {
    return (
      <table className="topic-table">
        <caption>ตารางวัยจรเชิงลึก (ช่วงละ 5 ปี)</caption>
        <thead>
          <tr>
            <th>ช่วงอายุ</th>
            <th>เสาวัยจร</th>
            <th>ราศี</th>
            <th>สภาวะ 12 เชี่ยงแซ</th>
          </tr>
        </thead>
        <tbody>
          {reading.daYunTimeline.map((row, index) => (
            <tr key={`${row.ageRange}-${index}`} data-current={row.isCurrent ? "true" : "false"}>
              <td>{row.ageRange}{row.isCurrent ? " ●" : ""}</td>
              <td>{row.symbol}</td>
              <td>{row.source}</td>
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
      <caption>ตารางความสัมพันธ์</caption>
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
}: TopicCardProps) {
  const [mode, setMode] = useState<TopicReadingMode>("engine");

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
          <RelationTable reading={result.reading} />

          {result.reading.method.length > 0 && (
            <section className="topic-card__block">
              <h4>วิธีการอ่าน</h4>
              <ul>
                {result.reading.method.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="topic-card__block">
            <h4>
              คำอ่าน
              <span className="topic-card__source">จาก engine truth</span>
            </h4>
            {result.reading.prose.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>

          <section className="topic-card__block topic-card__human">
            <h4>
              ผลการทำนาย
              <span className="topic-card__source">
                {result.source === "llm" ? `เรียบเรียงโดย LLM (${result.model})` : "จาก knownlage"}
              </span>
            </h4>
            {result.humanReading
              ? result.humanReading.split("\n\n").map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))
              : (
                <p className="topic-card__empty">
                  ยังไม่มีองค์ความรู้ภาษามนุษย์สำหรับหัวข้อนี้ (รอ ingest จาก docx ใน knownlage)
                </p>
              )}
            {result.sourceLabel && (
              <p className="topic-card__citation">อ้างอิง: {result.sourceLabel}</p>
            )}
          </section>
        </div>
      )}

      {topic.kind === "basis" && !result && (
        <p className="section-note">กดคำนวณดวงด้านบนเพื่อแสดงฐานคำนวณ</p>
      )}
    </Surface>
  );
}
