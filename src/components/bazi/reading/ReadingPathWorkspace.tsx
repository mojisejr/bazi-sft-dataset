"use client";

import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";

import { BirthForm } from "@/components/bazi/BirthForm";
import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { ReadingChartFoundation } from "@/components/bazi/reading/ReadingChartFoundation";
import {
  TopicCard,
  type RelationshipLineRow,
  type TopicReadingMode,
  type TopicReadingResult,
} from "@/components/bazi/reading/TopicCard";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
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
  // ควบคุม "รวมทุกบท"
  const [allMode, setAllMode] = useState<TopicReadingMode>("engine");
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  // บทเสริม: ตารางเส้นขีดความสัมพันธ์ (แสดงท้ายสุดหลังบท 15)
  const [relationshipLines, setRelationshipLines] = useState<RelationshipLineRow[] | null>(null);

  const predictTopic = useCallback(
    async (
      topicId: string,
      mode: TopicReadingMode,
      apiKey: string | null,
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
      void predictTopic(topicId, mode, apiKey, rawInput, calculatedState);
    },
    [rawInput, calculatedState, predictTopic],
  );

  const PREDICT_TOPICS = TOPIC_PATH.filter((topic) => topic.kind === "predict");

  // ดึงตารางเส้นขีดความสัมพันธ์ (deterministic, engine) ครั้งเดียวหลังคำนวณ
  async function loadRelationshipLines(input: RawInputValue, state: CalculatedStateValue) {
    try {
      const response = await fetch("/api/reading/topic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topicId: "turning_points", mode: "engine", rawInput: input, calculatedState: state }),
      });
      const body = (await response.json()) as { relationshipLines?: RelationshipLineRow[] };
      if (response.ok && body.relationshipLines) {
        setRelationshipLines(body.relationshipLines);
      }
    } catch {
      // เงียบ — ตารางเสริมไม่ critical
    }
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
      await predictTopic(PREDICT_TOPICS[index].id, allMode, key, rawInput, calculatedState);
      setBatchProgress({ done: index + 1, total: PREDICT_TOPICS.length });
    }
    setBatchProgress(null);
  }

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setFormState((current) => applyFormFieldChange(current, name, value));
  }

  function handleReset() {
    setFormState(createDefaultFormState());
    setSubmissionState("idle");
    setCalcError(null);
    setRawInput(null);
    setCalculatedState(null);
    setTopicStates({});
    setRelationshipLines(null);
    setApiKey("");
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
      setRelationshipLines(null);
      void loadRelationshipLines(payload, parsedState);
    } catch (error) {
      setSubmissionState("error");
      setCalcError(normalizeErrorMessage(error));
    }
  }

  const isReady = Boolean(calculatedState && rawInput);

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
          <label className="field field--compact reading-path__apikey">
            <span>Gemini API key (ใช้ร่วมทุกบท — กรอกครั้งเดียว, ไม่บันทึก)</span>
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
            <ActionButton tone="secondary" type="button" onClick={() => window.print()}>
              พิมพ์รายงาน
            </ActionButton>
          </div>
          {allMode === "llm" && (
            <p className="section-note">โหมด LLM รวมทุกบท = เรียก API {PREDICT_TOPICS.length} ครั้ง (ทีละบท)</p>
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
            note="อ้างอิงโครงสร้างจาก M.docx (Relationship Lines Mapping) — ประเมินตามดิถีและสภาวะวัยจรแต่ละช่วง 5 ปี"
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
