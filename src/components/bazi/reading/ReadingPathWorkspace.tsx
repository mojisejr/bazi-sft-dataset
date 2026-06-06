"use client";

import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";

import { BirthForm } from "@/components/bazi/BirthForm";
import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { ReadingChartFoundation } from "@/components/bazi/reading/ReadingChartFoundation";
import {
  TopicCard,
  type TopicReadingMode,
  type TopicReadingResult,
} from "@/components/bazi/reading/TopicCard";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import type { ReadingLlmProvider } from "@/lib/bazi/reading-llm";
import {
  applyFormFieldChange,
  buildPayload,
  createDefaultFormState,
  normalizeErrorMessage,
  type FormState,
  type SubmissionState,
} from "@/lib/bazi/trainer-workspace";
import {
  CalculatedStateSchema,
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";

type TopicCardStatus = "idle" | "loading" | "done" | "error";

type TopicEntryState = {
  status: TopicCardStatus;
  result: TopicReadingResult | null;
  error: string | null;
};

const EMPTY_TOPIC_STATE: TopicEntryState = { status: "idle", result: null, error: null };

/**
 * บทที่ต้อง "ครบ-ห้ามตัด" ตามคำกำชับซินแซ — บังคับใช้ผล engine ใน doc export เสมอ
 * ไม่ส่ง LLM polish เป็น override เพราะชั้น LLM มักย่อ/ตัดรายการอาชีพและจัดธาตุผิด
 * (บทที่ 1 นิสัยพื้นฐาน: ราศีบน/ล่าง/เซี่ยงแซจากชุดข้อมูล, บทที่ 2 อาชีพ: Useful God + Market เซี่ยงแซเต็ม)
 */
// หมายเหตุ: ใช้ TOPIC_PATH id (คีย์เดียวกับ topicStates / readings override) ไม่ใช่ BAZI_TOPIC_IDS
const ENGINE_ONLY_TOPIC_IDS = new Set<string>([
  "chart_foundation", // บท 1 นิสัยพื้นฐาน
  "career_potential", // บท 2 อาชีพ
  "wealth_and_investment", // บท 3 โชคลาภ
  "benefactor", // บท 4 ผู้อุปถัมภ์
  "talent", // บท 5 พรสวรรค์
  "family", // บท 6 ครอบครัว
  "love_partner", // บท 7 ความรัก/คู่ครอง
  "friends_foes", // บท 8 เพื่อน/ศัตรู
  "partnership", // บท 9 หุ้นส่วน
  "subordinates", // บท 10 ลูกน้อง/บริวาร
  "education", // บท 11 การเรียน
  "turning_points", // บท 12 ช่วงอายุดี/ระวัง
  "health", // บท 13 สุขภาพ
  "colors_directions", // บท 14 สี/ทิศ
  "guardian_deities", // บท 15 องค์เทพ/เสริมดวง
]);

const RESET_ACTION_COPY = {
  label: "ผูกดวงใหม่",
  detail: "ล้างข้อมูลเกิดและคำอ่านทุกหัวข้อ เพื่อเริ่มเคสใหม่",
  tone: "secondary" as const,
};

export function ReadingPathWorkspace() {
  const [formState, setFormState] = useState<FormState>(createDefaultFormState);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [calcError, setCalcError] = useState<string | null>(null);
  const [rawInput, setRawInput] = useState<RawInputValue | null>(null);
  const [calculatedState, setCalculatedState] = useState<CalculatedStateValue | null>(null);
  const [topicStates, setTopicStates] = useState<Record<string, TopicEntryState>>({});
  // API key รวม (ช่องเดียว) ใช้ทั้งรายบทและรวมทุกบท
  const [apiKey, setApiKey] = useState("");
  // ค่าย LLM ที่ใช้เรียบเรียง (ช่องเดียวด้านบน) — gemini หรือ opencode (OpenCode Zen)
  const [provider, setProvider] = useState<ReadingLlmProvider>("gemini");
  // ควบคุม "รวมทุกบท"
  const [allMode, setAllMode] = useState<TopicReadingMode>("engine");
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  const predictTopic = useCallback(
    async (
      topicId: string,
      mode: TopicReadingMode,
      apiKey: string | null,
      provider: ReadingLlmProvider,
      input: RawInputValue,
      state: CalculatedStateValue,
    ) => {
      setTopicStates((current) => ({
        ...current,
        [topicId]: { ...EMPTY_TOPIC_STATE, status: "loading" },
      }));

      try {
        const response = await fetch("/api/reading/topic", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            topicId,
            mode,
            rawInput: input,
            calculatedState: state,
            provider,
            ...(apiKey ? { apiKey } : {}),
          }),
        });

        const body = (await response.json()) as Partial<TopicReadingResult> & {
          error?: { message: string };
        };

        if (!response.ok || body.error || !body.source || !body.reading) {
          throw new Error(body.error?.message ?? "ทำนายหัวข้อนี้ไม่สำเร็จ");
        }

        setTopicStates((current) => ({
          ...current,
          [topicId]: { status: "done", result: body as TopicReadingResult, error: null },
        }));
      } catch (error) {
        setTopicStates((current) => ({
          ...current,
          [topicId]: { status: "error", result: null, error: normalizeErrorMessage(error) },
        }));
      }
    },
    [],
  );

  const handlePredict = useCallback(
    (topicId: string, mode: TopicReadingMode, apiKey: string | null) => {
      if (!rawInput || !calculatedState) {
        return;
      }
      void predictTopic(topicId, mode, apiKey, provider, rawInput, calculatedState);
    },
    [rawInput, calculatedState, predictTopic, provider],
  );

  const PREDICT_TOPICS = TOPIC_PATH.filter((topic) => topic.kind === "predict");

  // auto-run โหมด engine ทุกบทหลังคำนวณดวง → คำทำนายจาก knownlage ขึ้นเองแต่แรก
  // (รวมบท turning_points ที่ผลลัพธ์มี relationshipLines มาด้วย → ตารางบทเสริมมาเองหลังบท 15)
  async function runAllEngine(input: RawInputValue, state: CalculatedStateValue) {
    setBatchProgress({ done: 0, total: PREDICT_TOPICS.length });
    for (let index = 0; index < PREDICT_TOPICS.length; index += 1) {
      await predictTopic(PREDICT_TOPICS[index].id, "engine", null, provider, input, state);
      setBatchProgress({ done: index + 1, total: PREDICT_TOPICS.length });
    }
    setBatchProgress(null);
  }

  async function handlePredictAll() {
    if (!rawInput || !calculatedState || batchProgress) {
      return;
    }
    if (allMode === "llm" && apiKey.trim().length === 0) {
      return;
    }
    const key = allMode === "llm" ? apiKey.trim() : null;
    setBatchProgress({ done: 0, total: PREDICT_TOPICS.length });
    for (let index = 0; index < PREDICT_TOPICS.length; index += 1) {
      // ยิงทีละบทตามลำดับ เพื่อคุม cost (โดยเฉพาะโหมด llm) และโชว์ progress
      await predictTopic(PREDICT_TOPICS[index].id, allMode, key, provider, rawInput, calculatedState);
      setBatchProgress({ done: index + 1, total: PREDICT_TOPICS.length });
    }
    setBatchProgress(null);
  }

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setFormState((current) => applyFormFieldChange(current, name, value));
  }

  const [exporting, setExporting] = useState<"engine" | "llm" | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // ดาวน์โหลดรายงาน .docx — แยก 2 ฉบับ:
  //   "engine" = ผล engine ล้วนทุกบท (ครบ-ไม่ตัด ตามคำกำชับซินแซ)
  //   "llm"    = ใส่ผล LLM เฉพาะบทที่ผู้ใช้ทำนายด้วย LLM ไว้ ที่เหลือ fallback engine
  async function handleExportDocx(variant: "engine" | "llm") {
    if (!rawInput || !calculatedState || exporting) {
      return;
    }
    setExporting(variant);
    try {
      const readings: Record<string, string> = {};
      if (variant === "llm") {
        for (const [topicId, entry] of Object.entries(topicStates)) {
          const text = entry.result?.humanReading;
          // เอาเฉพาะบทที่ผู้ใช้สั่งทำนายด้วย LLM เอง ที่เหลือปล่อยให้ engine render
          if (text && entry.result?.source === "llm") {
            readings[topicId] = text;
          }
        }
      }
      // ตารางบทเสริม (วัยจร): ฉบับ LLM ใช้ที่ generate แล้ว (รวม LLM แต่งคำ ถ้ามี); ฉบับ engine ปล่อยให้ engine คำนวณเอง
      const relationshipLines =
        variant === "llm"
          ? (topicStates["turning_points"]?.result?.relationshipLines ?? undefined)
          : undefined;
      const response = await fetch("/api/reading/export-docx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawInput, calculatedState, readings, relationshipLines }),
      });
      if (!response.ok) {
        throw new Error("สร้างไฟล์ .docx ไม่สำเร็จ");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reading-${rawInput.birthDate}-${rawInput.gender}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // เงียบ — ปุ่มยังกดซ้ำได้
    } finally {
      setExporting(null);
    }
  }

  function handleReset() {
    setFormState(createDefaultFormState());
    setSubmissionState("idle");
    setCalcError(null);
    setRawInput(null);
    setCalculatedState(null);
    setTopicStates({});
    setApiKey("");
    setProvider("gemini");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionState === "submitting") {
      return;
    }

    const payload = buildPayload(formState);
    setSubmissionState("submitting");
    setCalcError(null);

    try {
      const response = await fetch("/api/bazi/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as { calculatedState?: unknown; error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "ยังไม่สามารถคำนวณดวงได้ในตอนนี้");
      }

      const parsedState = CalculatedStateSchema.parse(body.calculatedState);
      setRawInput(payload);
      setCalculatedState(parsedState);
      setSubmissionState("ready");
      setTopicStates({});
      // auto-run engine ทุกบททันที → คำทำนาย knownlage + ตารางบทเสริมขึ้นเองแต่แรก
      void runAllEngine(payload, parsedState);
    } catch (error) {
      setSubmissionState("error");
      setCalcError(normalizeErrorMessage(error));
    }
  }

  const isReady = Boolean(calculatedState && rawInput);
  // ตารางบทเสริมมาจากผลบท turning_points ที่ auto-run แล้ว (ไม่ต้อง fetch แยกอีก)
  const relationshipLines = topicStates["turning_points"]?.result?.relationshipLines ?? null;
  // จำนวนบทที่มีคำอ่านพร้อมแล้ว (ใช้คุมปุ่ม preview + แสดงความคืบหน้า)
  const doneCount = PREDICT_TOPICS.filter(
    (topic) => Boolean(topicStates[topic.id]?.result?.humanReading),
  ).length;

  return (
    <div className="reading-path">
      <section className="reading-path__intro surface">
        <SectionHeading
          kicker="อ่านดวงทีละหัวข้อ"
          title="Stepwise Path Reading"
          titleLevel="h2"
          note="กรอกข้อมูลเกิด คำนวณดวง แล้วกดทำนายทีละหัวข้อจนครบทั้ง path — ทุกคำอ่าน ground จาก engine truth ไม่ได้มาจากการแต่งของ AI"
        />
        <BirthForm
          formState={formState}
          submittedInput={rawInput}
          isSessionLocked={isReady}
          submissionState={submissionState}
          resetActionCopy={RESET_ACTION_COPY}
          onFieldChange={handleFieldChange}
          onSubmit={handleSubmit}
          onReset={handleReset}
        />
        {calcError && <p className="topic-card__error" role="alert">{calcError}</p>}
      </section>

      {isReady && calculatedState && (
        <ReadingChartFoundation calculatedState={calculatedState} />
      )}

      {isReady && (
        <section className="reading-path__batch surface">
          <label className="field field--compact reading-path__provider">
            <span>ค่าย LLM (เลือกครั้งเดียว ใช้ร่วมทุกบท)</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as ReadingLlmProvider)}
            >
              <option value="gemini">Gemini (Google)</option>
              <option value="opencode">OpenCode Zen</option>
            </select>
          </label>
          <label className="field field--compact reading-path__apikey">
            <span>
              {provider === "opencode" ? "OpenCode Zen" : "Gemini"} API key
              {" "}(ใช้ร่วมทุกบท — กรอกครั้งเดียว, ไม่บันทึก)
            </span>
            <input
              type="password"
              autoComplete="off"
              placeholder="วาง API key ที่นี่ที่เดียว เมื่อจะใช้โหมด LLM"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </label>
          <div className="reading-path__batch-controls">
            <div className="topic-card__mode" role="group" aria-label="โหมดรวมทุกบท">
              <button
                type="button"
                className={allMode === "engine" ? "mode-pill mode-pill--active" : "mode-pill"}
                aria-pressed={allMode === "engine"}
                onClick={() => setAllMode("engine")}
              >
                Engine
              </button>
              <button
                type="button"
                className={allMode === "llm" ? "mode-pill mode-pill--active" : "mode-pill"}
                aria-pressed={allMode === "llm"}
                onClick={() => setAllMode("llm")}
              >
                LLM
              </button>
            </div>
            <ActionButton
              tone="primary"
              type="button"
              disabled={Boolean(batchProgress) || (allMode === "llm" && apiKey.trim().length === 0)}
              onClick={() => void handlePredictAll()}
            >
              {batchProgress
                ? `กำลังทำนาย ${batchProgress.done}/${batchProgress.total}...`
                : `ทำนายรวมทุกบท (${PREDICT_TOPICS.length} บท)`}
            </ActionButton>
            <ActionButton
              tone="secondary"
              type="button"
              disabled={doneCount === 0}
              onClick={() => setShowPreview((value) => !value)}
            >
              {showPreview ? "ซ่อนตัวอย่าง" : `ดูตัวอย่างรายงาน (${doneCount}/${PREDICT_TOPICS.length})`}
            </ActionButton>
            <ActionButton tone="secondary" type="button" onClick={() => window.print()}>
              พิมพ์รายงาน
            </ActionButton>
            <ActionButton
              tone="secondary"
              type="button"
              disabled={exporting !== null}
              onClick={() => void handleExportDocx("engine")}
            >
              {exporting === "engine" ? "กำลังสร้าง .docx..." : "ดาวน์โหลด .docx (engine)"}
            </ActionButton>
            <ActionButton
              tone="secondary"
              type="button"
              disabled={exporting !== null}
              onClick={() => void handleExportDocx("llm")}
            >
              {exporting === "llm" ? "กำลังสร้าง .docx..." : "ดาวน์โหลด .docx (LLM)"}
            </ActionButton>
          </div>
          {batchProgress && (
            <div
              className="reading-path__progress"
              role="progressbar"
              aria-valuenow={batchProgress.done}
              aria-valuemin={0}
              aria-valuemax={batchProgress.total}
              aria-label="ความคืบหน้าการทำนายรวมทุกบท"
            >
              <div
                className="reading-path__progress-bar"
                style={{ width: `${Math.round((batchProgress.done / batchProgress.total) * 100)}%` }}
              />
              <span className="reading-path__progress-label">
                {allMode === "llm" ? "กำลังเรียบเรียงด้วย LLM" : "กำลังทำนาย"} {batchProgress.done}/{batchProgress.total} บท
              </span>
            </div>
          )}
          {allMode === "llm" && (
            <p className="section-note">โหมด LLM รวมทุกบท = เรียก API {PREDICT_TOPICS.length} ครั้ง (ทีละบท)</p>
          )}
        </section>
      )}

      {isReady && showPreview && (
        <section className="surface reading-path__preview" aria-label="ตัวอย่างรายงาน">
          <SectionHeading
            kicker="ตัวอย่างรายงาน (เรียงตามไฟล์ .docx)"
            title="พรีวิวก่อนดาวน์โหลด"
            titleLevel="h2"
            note="ตรวจเนื้อหาทั้ง 15 บท (ฉบับบนจอ รวม LLM polish ถ้ามี) ตามลำดับที่จะออกในไฟล์ Word"
          />
          {PREDICT_TOPICS.map((topic) => {
            const text = topicStates[topic.id]?.result?.humanReading;
            return (
              <article key={topic.id} className="reading-path__preview-chapter">
                <h3>บทที่ {topic.chapter}: {topic.title}</h3>
                {text
                  ? text.split("\n\n").map((para, index) => <p key={index}>{para}</p>)
                  : <p className="section-note">(ยังไม่ได้ทำนายบทนี้)</p>}
              </article>
            );
          })}
          {relationshipLines && relationshipLines.length > 0 && (
            <article className="reading-path__preview-chapter">
              <h3>บทเสริม: ตารางวิเคราะห์เส้นขีดความสัมพันธ์ (วัยจรช่วงละ 5 ปี)</h3>
              <table className="topic-table">
                <thead>
                  <tr><th>ช่วงอายุ</th><th>เสาวัยจร</th><th>เส้นขีด</th><th>คำอธิบาย</th></tr>
                </thead>
                <tbody>
                  {relationshipLines.map((row, index) => (
                    <tr key={`${row.ageRange}-${index}`}>
                      <td>{row.ageRange}</td><td>{row.symbol}</td><td>{row.relationLine}</td><td>{row.deepNote}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          )}
        </section>
      )}

      {isReady && (
        <section className="reading-path__topics" aria-label="หัวข้อการอ่าน">
          {PREDICT_TOPICS.map((topic) => {
            const entry = topicStates[topic.id] ?? EMPTY_TOPIC_STATE;
            return (
              <TopicCard
                key={topic.id}
                topic={topic}
                disabled={!isReady}
                status={entry.status}
                result={entry.result}
                errorMessage={entry.error}
                apiKey={apiKey}
                onPredict={handlePredict}
              />
            );
          })}
        </section>
      )}

      {isReady && relationshipLines && relationshipLines.length > 0 && (
        <section className="surface reading-path__appendix" aria-label="บทเสริม">
          <SectionHeading
            kicker="บทเสริม (ต่อจากบทที่ 15)"
            title="ตารางวิเคราะห์เส้นขีดความสัมพันธ์ — หมวดช่วงอายุและวัยจร"
            titleLevel="h2"
            note="ประเมินตามดิถีและสภาวะวัยจรแต่ละช่วง 5 ปี (บทบาทธาตุ × 12 เชี่ยงแซ × กำลังดิถี)"
          />
          <table className="topic-table">
            <thead>
              <tr>
                <th>ช่วงอายุ</th>
                <th>เสาวัยจร</th>
                <th>เส้นขีดที่ทำงาน</th>
                <th>คำอธิบายดี-ร้ายเชิงลึก</th>
              </tr>
            </thead>
            <tbody>
              {relationshipLines.map((row, index) => (
                <tr key={`${row.ageRange}-${index}`}>
                  <td>{row.ageRange}</td>
                  <td>{row.symbol}</td>
                  <td>{row.relationLine}</td>
                  <td>{row.deepNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
