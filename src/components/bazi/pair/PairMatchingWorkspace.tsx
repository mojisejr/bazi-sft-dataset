"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import { ReadingChartFoundation } from "@/components/bazi/reading/ReadingChartFoundation";
import { PairDetailModal } from "@/components/bazi/pair/PairDetailModal";
import { PairPrintReport } from "@/components/bazi/pair/PairPrintReport";
import { PersonInputs } from "@/components/bazi/pair/PersonInputs";
import {
  buildEngineText,
  DOMAIN_LABEL,
  sisingDomainAspects,
  verdictLabel,
} from "@/components/bazi/pair/pair-presentation";
import {
  applyFormFieldChange,
  buildPayload,
  createDefaultFormState,
  type FormState,
} from "@/lib/bazi/trainer-workspace";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";
import type { PairComparisonResult } from "@/lib/bazi/pair-types";
import type { ReadingLlmProvider } from "@/lib/bazi/reading-llm";

const DOMAIN = "love" as const;

type PairResponse = {
  personA: CalculatedStateValue;
  personB: CalculatedStateValue;
  comparison: PairComparisonResult;
};

type ModalKind = "chart" | "sising" | null;

export function PairMatchingWorkspace() {
  const [formA, setFormA] = useState<FormState>(createDefaultFormState);
  const [formB, setFormB] = useState<FormState>(() => ({ ...createDefaultFormState(), gender: "male" }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PairResponse | null>(null);
  const [dateText, setDateText] = useState("");
  const [currentYear, setCurrentYear] = useState(0);
  const [submittedA, setSubmittedA] = useState<RawInputValue | null>(null);
  const [submittedB, setSubmittedB] = useState<RawInputValue | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<ReadingLlmProvider>("gemini");
  const [llmText, setLlmText] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);

  const onChangeA = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormA((cur) => applyFormFieldChange(cur, e.target.name, e.target.value));
  }, []);
  const onChangeB = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormB((cur) => applyFormFieldChange(cur, e.target.name, e.target.value));
  }, []);

  const onCompare = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setLlmText(null);
    try {
      const payloadA = buildPayload(formA);
      const payloadB = buildPayload(formB);
      const response = await fetch("/api/bazi/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personA: payloadA, personB: payloadB }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "คำนวณไม่สำเร็จ");
      }
      setResult(data as PairResponse);
      setSubmittedA(payloadA);
      setSubmittedB(payloadB);
      const now = new Date();
      setCurrentYear(now.getFullYear());
      setDateText(now.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }, [formA, formB]);

  const pair = result ? result.comparison.match[DOMAIN] : null;

  const onRephrase = useCallback(async () => {
    if (!result || !pair) return;
    if (provider !== "anthropic" && apiKey.trim().length === 0) {
      setError("กรุณาใส่ API key ก่อนเรียบเรียงด้วย LLM");
      return;
    }
    setLlmLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/bazi/pair/rephrase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          engineText: buildEngineText(pair, DOMAIN, result.comparison),
          domainLabel: `ความเข้ากันด้าน${DOMAIN_LABEL[DOMAIN]}`,
          provider,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "เรียบเรียงไม่สำเร็จ");
      }
      setLlmText(data.text as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เรียก LLM ไม่สำเร็จ");
    } finally {
      setLlmLoading(false);
    }
  }, [result, pair, provider, apiKey]);

  const sisingActiveCode = pair?.forward.sising?.code ?? null;
  const sisingRef = result?.comparison.sisingReference ?? [];

  const modalTitle = useMemo(() => {
    switch (modal) {
      case "chart": return "ผังธาตุ 2 คน";
      case "sising": return "12 สี่ซิ้ง (ดาวประจำดวง)";
      default: return "";
    }
  }, [modal]);

  const roles = result ? result.comparison.loveRoles : [];

  return (
    <div className="pair-shell">
      <Surface as="section" inset>
        <SectionHeading
          kicker="กรอกข้อมูล 2 คน"
          title="ตั้งวันเกิดของทั้งสองฝ่าย"
          note="ระบบใช้เวลาประเทศไทย + ปฏิทินสุริยคติ และจับคู่จากหลักวัน (วันเกิด) ของทั้งคู่"
        />
        <div className="pair-forms">
          <PersonInputs label="คนที่ 1" form={formA} onChange={onChangeA} />
          <PersonInputs label="คนที่ 2" form={formB} onChange={onChangeB} />
        </div>
        <div className="pair-actions" style={{ marginTop: "1rem" }}>
          <ActionButton tone="primary" type="button" disabled={submitting} onClick={onCompare}>
            {submitting ? "กำลังคำนวณ..." : "เปรียบเทียบดวง"}
          </ActionButton>
          {error ? <span className="pair-error">{error}</span> : null}
        </div>
      </Surface>

      {result && pair ? (
        <Surface as="section" inset className="pair-result">
          {/* ── คำทำนายพื้นฐานรายคน ── */}
          <SectionHeading kicker="คำทำนายพื้นฐาน" title="หลักวัน & นิสัยของแต่ละคน" compact />
          <div className="pair-person-grid">
            {([
              { who: "คนที่ 1", p: result.comparison.personA },
              { who: "คนที่ 2", p: result.comparison.personB },
            ]).map(({ who, p }) => (
              <div key={who} className="pair-person-card">
                <div className="pair-person-card__head">
                  <span className="pair-person-card__who">{who}</span>
                  <span className="pair-person-card__pillar">
                    {p.dayPillar.stem}{p.dayPillar.branch} · ดิถี{p.elementTh}{p.stageTh ? ` · ${p.stageTh}` : ""}
                  </span>
                </div>
                <ul className="pair-nisai-list">
                  {p.nisai.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* ── ความเข้ากัน ── */}
          <SectionHeading kicker="ความเข้ากัน" title={`ดวงสมพงษ์ด้าน${DOMAIN_LABEL[DOMAIN]}`} compact />

          {pair.forward.found || pair.reverse.found ? (
            <>
              <div className="pair-verdict">
                <div className="pair-verdict__grade">{pair.overallGrade}</div>
                <div className="pair-verdict__main">
                  <div className="pair-verdict__label">{verdictLabel(pair.overallPercent)}</div>
                  <div className="pair-verdict__pct">คะแนนรวม {pair.overallPercent}% · เฉลี่ยสองทิศ (สลับลำดับการกรอกได้ผลเท่าเดิม)</div>
                </div>
              </div>

              <div className="pair-direction-grid">
                {([
                  { dir: pair.forward, label: "คนที่ 1 ได้รับจากคนที่ 2" },
                  { dir: pair.reverse, label: "คนที่ 2 ได้รับจากคนที่ 1" },
                ]).map(({ dir, label }) => (
                  <div key={label} className="pair-direction">
                    <div className="pair-direction__head">
                      <span className="pair-direction__label">{label}</span>
                      <span className="pair-direction__grade">{dir.grade}</span>
                    </div>
                    <div className="pair-direction__meta">
                      <span>{dir.percent ?? "-"}%</span>
                      {dir.emoji ? <span className="pair-direction__emoji">{dir.emoji}</span> : null}
                      {dir.sising ? <span>สี่ซิ้ง: {dir.sising.nameTh}</span> : null}
                    </div>
                    <p className="pair-rating-text">{dir.ratingText}</p>
                  </div>
                ))}
              </div>

              <div className="pair-elem">
                <strong>ปฏิกิริยาธาตุ คนที่ 1 ({result.comparison.elementInteraction.aElementTh}) ↔ คนที่ 2 ({result.comparison.elementInteraction.bElementTh})</strong>
                <span>{result.comparison.elementInteraction.summaryTh}</span>
              </div>

              {/* สี่ซิ้งประจำคู่ + คำทำนายพื้นฐานตามด้าน */}
              {pair.forward.sising ? (
                <div className="pair-sising-feature">
                  <div className="pair-sising-feature__title">
                    สี่ซิ้งประจำคู่: {pair.forward.sising.nameTh}
                    <span className="pair-sising-card__score"> ({pair.forward.sising.nameCn} · พลัง {pair.forward.sising.score})</span>
                  </div>
                  <p className="pair-rating-text">{pair.forward.sising.long || pair.forward.sising.short}</p>
                  {sisingDomainAspects(pair.forward.sising, DOMAIN).map((a) => (
                    <p key={a.label} className="pair-rating-text"><strong>{a.label}:</strong> {a.text}</p>
                  ))}
                </div>
              ) : null}

              {/* บทบาทตามด้าน (inline) */}
              {roles.length ? (
                <div className="pair-roles">
                  <strong>บทบาทด้าน{DOMAIN_LABEL[DOMAIN]}</strong>
                  {roles.map((r, i) => (
                    <div key={i} className="pair-role">
                      <span className="pair-role__perspective">{r.perspective} · {r.stageName}</span>
                      <span>{r.narrative}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="pair-error">ไม่พบข้อมูลสมพงษ์สำหรับคู่หลักวันนี้ ({pair.forward.ourPillar} × {pair.forward.partnerPillar})</p>
          )}

          <div className="pair-popup-buttons">
            <ActionButton type="button" onClick={() => setModal("chart")}>ดูผังธาตุ 2 คน</ActionButton>
            <ActionButton type="button" onClick={() => setModal("sising")}>ดู 12 สี่ซิ้งทั้งหมด</ActionButton>
            <ActionButton tone="primary" type="button" onClick={() => window.print()}>
              บันทึกเป็น PDF / พิมพ์
            </ActionButton>
          </div>

          {/* ── เรียบเรียงด้วย LLM ── */}
          <SectionHeading kicker="เรียบเรียง" title="ทำคำทำนายให้อ่านลื่นด้วย LLM (ไม่บังคับ)" compact />
          <div className="pair-actions">
            <label className="field field--compact">
              <span>ผู้ให้บริการ</span>
              <select value={provider} onChange={(e) => setProvider(e.target.value as ReadingLlmProvider)}>
                <option value="gemini">Gemini</option>
                <option value="anthropic">Local Claude</option>
                <option value="opencode">OpenCode</option>
              </select>
            </label>
            <label className="field field--compact" style={{ flex: 1 }}>
              <span>API key {provider === "anthropic" ? "(เว้นว่างได้)" : ""}</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="วาง API key"
              />
            </label>
            <ActionButton type="button" disabled={llmLoading} onClick={onRephrase}>
              {llmLoading ? "กำลังเรียบเรียง..." : "เรียบเรียงด้วย LLM"}
            </ActionButton>
          </div>

          {llmText ? (
            <Surface as="div" inset>
              <SectionHeading kicker="ฉบับเรียบเรียง" title={`คำทำนายด้าน${DOMAIN_LABEL[DOMAIN]}`} compact />
              <p className="pair-rating-text" style={{ whiteSpace: "pre-wrap" }}>{llmText}</p>
            </Surface>
          ) : null}
        </Surface>
      ) : null}

      {modal && result ? (
        <PairDetailModal title={modalTitle} onClose={() => setModal(null)}>
          {modal === "chart" ? (
            <div className="pair-charts">
              <div>
                <SectionHeading kicker="คนที่ 1" title="พื้นดวง" compact />
                <ReadingChartFoundation calculatedState={result.personA} />
              </div>
              <div>
                <SectionHeading kicker="คนที่ 2" title="พื้นดวง" compact />
                <ReadingChartFoundation calculatedState={result.personB} />
              </div>
            </div>
          ) : null}

          {modal === "sising" ? (
            <>
              <p className="pair-score-card__score">
                สี่ซิ้งประจำคู่นี้คือ <strong>{pair?.forward.sising?.nameTh ?? "-"}</strong> (เน้นกรอบ) — ตารางด้านล่างคือความหมายของทั้ง 12 ดาว
              </p>
              <div className="pair-sising-grid">
                {sisingRef.map((s) => (
                  <div key={s.code} className="pair-sising-card" data-active={s.code === sisingActiveCode}>
                    <div className="pair-sising-card__name">
                      {s.nameTh} <span className="pair-sising-card__score">({s.nameCn} · {s.score})</span>
                    </div>
                    <div>{s.short}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </PairDetailModal>
      ) : null}

      {result ? (
        <PairPrintReport
          result={result}
          birthA={submittedA}
          birthB={submittedB}
          dateText={dateText}
          currentYear={currentYear}
        />
      ) : null}
    </div>
  );
}
