"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { BirthForm } from "@/components/bazi/BirthForm";
import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { ReadingChartFoundation } from "@/components/bazi/reading/ReadingChartFoundation";
import { PagedPreview } from "@/components/bazi/reading/PagedPreview";
import {
  ReadingPrintDocument,
  type PrintChapter,
} from "@/components/bazi/reading/ReadingPrintDocument";
import {
  TopicCard,
  type TopicReadingMode,
  type TopicReadingResult,
} from "@/components/bazi/reading/TopicCard";
import type { AddRuleInput } from "@/components/bazi/reading/SinsaeRuleBuilder";
import type { SubstitutionRule } from "@/lib/bazi/substitution-rules";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import type { ReadingLlmProvider } from "@/lib/bazi/reading-llm";
import {
  chartSignatureOf,
  clearCorrection,
  loadCorrections,
  readingFingerprint,
  resolveCorrection,
  saveCorrection,
  type SinsaeCorrection,
} from "@/lib/bazi/sinsae-corrections";
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

// คงข้อมูลวัน-เวลา-เพศ ไว้เมื่อ refresh (ไม่ต้องกรอกใหม่) — เก็บใน localStorage
const FORM_STORAGE_KEY = "bazi-reading-form-v1";

function loadStoredFormState(): FormState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FormState>;
    return { ...createDefaultFormState(), ...parsed };
  } catch {
    return null;
  }
}

const RESET_ACTION_COPY = {
  label: "ผูกดวงใหม่",
  detail: "ล้างข้อมูลเกิดและคำอ่านทุกหัวข้อ เพื่อเริ่มเคสใหม่",
  tone: "secondary" as const,
};

export function ReadingPathWorkspace() {
  const [formState, setFormState] = useState<FormState>(createDefaultFormState);
  // hydrate วัน-เวลา-เพศ จาก localStorage ครั้งเดียวตอน mount (กัน SSR mismatch) แล้ว save อัตโนมัติเมื่อแก้
  const formHydratedRef = useRef(false);
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
  // คลังคำแก้ของซินแส (localStorage) — โหลดครั้งเดียวตอน mount แล้วซิงค์กลับเมื่อแก้
  const [corrections, setCorrections] = useState<ReturnType<typeof loadCorrections>>({});

  useEffect(() => {
    setCorrections(loadCorrections());
  }, []);

  // ตารางคำแก้ (กฎแทนคำ) จาก server — โหลดครั้งเดียวตอน mount
  const [rules, setRules] = useState<SubstitutionRule[]>([]);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/reading/rules")
      .then((res) => res.json())
      .then((body: { rules?: SubstitutionRule[] }) => {
        if (active && Array.isArray(body.rules)) setRules(body.rules);
      })
      .catch(() => {
        /* เปิดหน้าได้แม้โหลดกฎไม่สำเร็จ */
      });
    return () => {
      active = false;
    };
  }, []);

  // โหลดค่าฟอร์มที่เคยกรอกครั้งเดียวตอน mount
  useEffect(() => {
    const stored = loadStoredFormState();
    if (stored) {
      setFormState(stored);
    }
    formHydratedRef.current = true;
  }, []);

  // บันทึกค่าฟอร์มทุกครั้งที่แก้ (หลัง hydrate แล้วเท่านั้น กันเขียนทับด้วยค่าว่าง)
  useEffect(() => {
    if (!formHydratedRef.current || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formState));
    } catch {
      /* localStorage เต็ม/ปิดอยู่ — ข้ามได้ */
    }
  }, [formState]);

  const predictTopic = useCallback(
    async (
      topicId: string,
      mode: TopicReadingMode,
      apiKey: string | null,
      provider: ReadingLlmProvider,
      input: RawInputValue,
      state: CalculatedStateValue,
      masterExamples?: string[],
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
            ...(mode === "llm" && masterExamples && masterExamples.length > 0
              ? { masterExamples }
              : {}),
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
      // โหมด LLM: ดึงคำที่ซินแสเคยแก้ (ดวงนี้ + ดวงอื่นที่ผลคล้ายกัน) มาเป็นตัวอย่างให้ LLM
      let masterExamples: string[] | undefined;
      const reading = topicStates[topicId]?.result?.reading;
      if (mode === "llm" && reading) {
        const match = resolveCorrection(
          corrections,
          topicId,
          reading,
          chartSignatureOf(rawInput),
        );
        const examples = [
          ...(match.exact ? [match.exact.corrected] : []),
          ...match.similar.map((item) => item.corrected),
        ].slice(0, 3);
        if (examples.length > 0) {
          masterExamples = examples;
        }
      }
      void predictTopic(topicId, mode, apiKey, provider, rawInput, calculatedState, masterExamples);
    },
    [rawInput, calculatedState, predictTopic, provider, corrections, topicStates],
  );

  const handleSaveCorrection = useCallback(
    (topicId: string, text: string) => {
      if (!rawInput) return;
      const result = topicStates[topicId]?.result;
      if (!result?.reading) return;
      const entry: SinsaeCorrection = {
        topicId,
        fingerprint: readingFingerprint(result.reading),
        chartSignature: chartSignatureOf(rawInput),
        original: result.humanReading ?? "",
        corrected: text,
        editedAt: new Date().toISOString(),
      };
      setCorrections((current) => saveCorrection(current, entry));
    },
    [rawInput, topicStates],
  );

  const handleClearCorrection = useCallback(
    (topicId: string) => {
      if (!rawInput) return;
      setCorrections((current) =>
        clearCorrection(current, topicId, chartSignatureOf(rawInput)),
      );
    },
    [rawInput],
  );

  // คำแก้ของซินแสที่เกี่ยวข้องกับดวงปัจจุบันต่อบท (exact = override, similar = ป้อน LLM)
  const correctionFor = useCallback(
    (topicId: string) => {
      const reading = topicStates[topicId]?.result?.reading;
      if (!rawInput || !reading) {
        return { exact: null as SinsaeCorrection | null, similar: [] as SinsaeCorrection[] };
      }
      return resolveCorrection(corrections, topicId, reading, chartSignatureOf(rawInput));
    },
    [topicStates, corrections, rawInput],
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

  async function handlePredictAll(
    modeOverride: TopicReadingMode = allMode,
    providerOverride: ReadingLlmProvider = provider,
  ) {
    if (!rawInput || !calculatedState || batchProgress) {
      return;
    }
    // Local Claude (anthropic) ผ่าน local proxy ไม่ต้องมี API key จริง → ใช้ placeholder "local"
    const localClaude = providerOverride === "anthropic";
    if (modeOverride === "llm" && !localClaude && apiKey.trim().length === 0) {
      return;
    }
    const key =
      modeOverride === "llm" ? (localClaude ? apiKey.trim() || "local" : apiKey.trim()) : null;
    setBatchProgress({ done: 0, total: PREDICT_TOPICS.length });
    for (let index = 0; index < PREDICT_TOPICS.length; index += 1) {
      // ยิงทีละบทตามลำดับ เพื่อคุม cost (โดยเฉพาะโหมด llm) และโชว์ progress
      await predictTopic(PREDICT_TOPICS[index].id, modeOverride, key, providerOverride, rawInput, calculatedState);
      setBatchProgress({ done: index + 1, total: PREDICT_TOPICS.length });
    }
    setBatchProgress(null);
  }

  // ปุ่มลัด: gen ทุกบทด้วย Local Claude (Anthropic) — ตั้ง provider+mode แล้วยิงทันทีด้วย override
  function handleGenerateLocalClaude() {
    setProvider("anthropic");
    setAllMode("llm");
    void handlePredictAll("llm", "anthropic");
  }

  // เพิ่มกฎแทนคำ → server เขียนไฟล์ + อัปเดต state แล้ว re-run engine ให้ผลบนจอสะท้อนกฎใหม่
  async function handleAddRule(input: AddRuleInput) {
    try {
      const response = await fetch("/api/reading/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, source: { kind: "manual" } }),
      });
      const body = (await response.json()) as { rules?: SubstitutionRule[]; error?: { message: string } };
      if (!response.ok || !body.rules) {
        throw new Error(body.error?.message ?? "เพิ่มกฎไม่สำเร็จ");
      }
      setRules(body.rules);
      if (rawInput && calculatedState && !batchProgress) {
        void runAllEngine(rawInput, calculatedState);
      }
    } catch {
      /* เงียบ — ผู้ใช้กดใหม่ได้ */
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      const response = await fetch(`/api/reading/rules?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { rules?: SubstitutionRule[] };
      setRules(body.rules ?? []);
      if (rawInput && calculatedState && !batchProgress) {
        void runAllEngine(rawInput, calculatedState);
      }
    } catch {
      /* เงียบ */
    }
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
      for (const topic of PREDICT_TOPICS) {
        const result = topicStates[topic.id]?.result;
        if (!result) continue;
        // ซินแส override: ถ้ามีคำแก้ของดวงนี้ ใส่เสมอ (ทั้งฉบับ engine และ llm)
        const sinsae = correctionFor(topic.id).exact;
        if (sinsae) {
          readings[topic.id] = sinsae.corrected;
        } else if (variant === "llm" && result.humanReading && result.source === "llm") {
          // ที่เหลือ: ฉบับ llm ใส่เฉพาะบทที่ผู้ใช้สั่งทำนายด้วย LLM เอง — engine ปล่อยให้ render เอง
          readings[topic.id] = result.humanReading;
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
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(FORM_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
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
  // Local Claude (anthropic) ไม่ต้องกรอก key จริง → ใช้ "local" แทน เพื่อให้ปุ่ม/รายบททำงานได้
  const localClaudeMode = provider === "anthropic";
  const effectiveApiKey = localClaudeMode ? apiKey.trim() || "local" : apiKey;
  // ตารางบทเสริมมาจากผลบท turning_points ที่ auto-run แล้ว (ไม่ต้อง fetch แยกอีก)
  const relationshipLines = topicStates["turning_points"]?.result?.relationshipLines ?? null;
  // จำนวนบทที่มีคำอ่านพร้อมแล้ว (ใช้คุมปุ่ม preview + แสดงความคืบหน้า)
  const doneCount = PREDICT_TOPICS.filter(
    (topic) => Boolean(topicStates[topic.id]?.result?.humanReading),
  ).length;

  // เนื้อหา 15 บทสำหรับเอกสาร PDF — ใช้ค่าที่แสดงบนจอ (ซินแสแก้ ?? engine humanReading)
  const printChapters: PrintChapter[] = PREDICT_TOPICS.map((topic) => {
    const sinsae = correctionFor(topic.id).exact;
    const result = topicStates[topic.id]?.result;
    return {
      chapter: topic.chapter,
      title: topic.title,
      id: topic.id,
      text: sinsae ? sinsae.corrected : (result?.humanReading ?? null),
    };
  });

  // พิมพ์เอกสาร YLC → Save as PDF (ติด class ชั่วคราวให้ @media print ซ่อนทุกอย่างยกเว้นเอกสาร)
  function handlePrintYlc() {
    if (typeof window === "undefined") return;
    document.body.classList.add("ylc-printing");
    const cleanup = () => {
      document.body.classList.remove("ylc-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

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
              <option value="anthropic">Local Claude (Anthropic)</option>
            </select>
          </label>
          <label className="field field--compact reading-path__apikey">
            <span>
              {provider === "opencode"
                ? "OpenCode Zen"
                : provider === "anthropic"
                  ? "Anthropic / Local Claude"
                  : "Gemini"}{" "}
              API key
              {" "}(ใช้ร่วมทุกบท — กรอกครั้งเดียว, ไม่บันทึก
              {provider === "anthropic" ? "; Local Claude ผ่าน proxy — เว้นว่างได้" : ""})
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
              disabled={Boolean(batchProgress) || (allMode === "llm" && !localClaudeMode && apiKey.trim().length === 0)}
              onClick={() => void handlePredictAll()}
            >
              {batchProgress
                ? `กำลังทำนาย ${batchProgress.done}/${batchProgress.total}...`
                : `ทำนายรวมทุกบท (${PREDICT_TOPICS.length} บท)`}
            </ActionButton>
            <ActionButton
              tone="primary"
              type="button"
              disabled={Boolean(batchProgress)}
              onClick={() => handleGenerateLocalClaude()}
            >
              {batchProgress
                ? `Local Claude ${batchProgress.done}/${batchProgress.total}...`
                : `🤖 Gen ด้วย Local Claude`}
            </ActionButton>
            <ActionButton
              tone="primary"
              type="button"
              disabled={doneCount === 0}
              onClick={() => setShowPreview(true)}
            >
              {`ดูตัวอย่าง & บันทึก PDF (${doneCount}/${PREDICT_TOPICS.length})`}
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

      {isReady && (
        <section className="surface reading-path__rules" aria-label="ตารางคำแก้">
          <button
            type="button"
            className="reading-path__rules-toggle"
            aria-expanded={showRules}
            onClick={() => setShowRules((value) => !value)}
          >
            <span aria-hidden="true">{showRules ? "▾" : "▸"}</span>
            📋 ตารางคำแก้ (กฎแทนคำ) · {rules.length} กฎ
          </button>
          {showRules && (
            <div className="reading-path__rules-body">
              {rules.length === 0 ? (
                <p className="section-note">
                  ยังไม่มีกฎ — แก้คำทำนายบทใดบทหนึ่งแล้วกด “บันทึกเป็นกฎ” หรือกรอกมือในกล่องของบทนั้น
                  คำที่ตั้งไว้จะถูกแทนให้ทุกดวงที่ทายได้วลีเดียวกัน
                </p>
              ) : (
                <table className="topic-table reading-path__rules-table">
                  <thead>
                    <tr>
                      <th>ใช้กับ</th>
                      <th>คำเดิม</th>
                      <th>แก้เป็น</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id}>
                        <td>{rule.scope === "global" ? "ทุกบท" : rule.topicId}</td>
                        <td>{rule.match}</td>
                        <td>{rule.replacement.length === 0 ? "(ลบทิ้ง)" : rule.replacement}</td>
                        <td>
                          <button
                            type="button"
                            className="topic-card__sinsae-link topic-card__sinsae-link--danger"
                            onClick={() => void handleDeleteRule(rule.id)}
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}

      {isReady && showPreview && rawInput && calculatedState && typeof document !== "undefined"
        ? createPortal(
            <div className="ylc-print-portal">
              <div className="ylc-preview" role="dialog" aria-label="ตัวอย่างรายงาน YLC">
                <div className="ylc-preview__toolbar">
                  <span className="ylc-preview__toolbar-title">
                    ตัวอย่างรายงาน YLC · เกิด {rawInput.birthDate} {rawInput.birthTime} น.
                  </span>
                  <div className="ylc-preview__toolbar-actions">
                    <button
                      type="button"
                      className="ylc-preview__btn ylc-preview__btn--primary"
                      onClick={handlePrintYlc}
                    >
                      บันทึกเป็น PDF / พิมพ์
                    </button>
                    <button
                      type="button"
                      className="ylc-preview__btn ylc-preview__btn--ghost"
                      onClick={() => setShowPreview(false)}
                    >
                      ปิด
                    </button>
                  </div>
                </div>
                <div className="ylc-preview__stage">
                  <PagedPreview>
                    <ReadingPrintDocument
                      rawInput={rawInput}
                      calculatedState={calculatedState}
                      chapters={printChapters}
                      relationshipLines={relationshipLines}
                    />
                  </PagedPreview>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {isReady && (
        <section className="reading-path__topics" aria-label="หัวข้อการอ่าน">
          {PREDICT_TOPICS.map((topic) => {
            const entry = topicStates[topic.id] ?? EMPTY_TOPIC_STATE;
            const match = correctionFor(topic.id);
            return (
              <TopicCard
                key={topic.id}
                topic={topic}
                disabled={!isReady}
                status={entry.status}
                result={entry.result}
                errorMessage={entry.error}
                apiKey={effectiveApiKey}
                onPredict={handlePredict}
                savedCorrection={match.exact}
                similarCount={match.similar.length}
                onSaveCorrection={handleSaveCorrection}
                onClearCorrection={handleClearCorrection}
                onAddRule={handleAddRule}
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
