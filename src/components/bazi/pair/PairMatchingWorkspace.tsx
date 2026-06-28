"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import { ReadingChartFoundation } from "@/components/bazi/reading/ReadingChartFoundation";
import { PairDetailModal } from "@/components/bazi/pair/PairDetailModal";
import { PairPrintReport } from "@/components/bazi/pair/PairPrintReport";
import { PairPillarsCompare } from "@/components/bazi/pair/PairPillarsCompare";
import { PairCompatBars } from "@/components/bazi/pair/PairCompatBars";
import { PairFacetReadings } from "@/components/bazi/pair/PairFacetReadings";
import { PersonInputs } from "@/components/bazi/pair/PersonInputs";
import {
  buildFacetEngineText,
  DOMAIN_LABEL,
  RELATIONSHIP_META,
  sisingDomainAspects,
  verdictLabel,
} from "@/components/bazi/pair/pair-presentation";
import {
  applyFormFieldChange,
  buildPayload,
  createDefaultFormState,
  isFormComplete,
  type FormState,
} from "@/lib/bazi/trainer-workspace";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";
import type { MatchFacet, PairComparisonResult, RelationshipType } from "@/lib/bazi/pair-types";
import type { ReadingLlmProvider } from "@/lib/bazi/reading-llm";

const RELATIONSHIP_OPTIONS: RelationshipType[] = ["love", "partner", "boss", "subordinate"];

type PairResponse = {
  personA: CalculatedStateValue;
  personB: CalculatedStateValue;
  comparison: PairComparisonResult;
  relationship: RelationshipType;
  facets: MatchFacet[];
  mainFacet: MatchFacet | null;
};

type ModalKind = "chart" | "sising" | null;

export function PairMatchingWorkspace() {
  const [formA, setFormA] = useState<FormState>(createDefaultFormState);
  const [formB, setFormB] = useState<FormState>(() => ({ ...createDefaultFormState(), gender: "male" }));
  const [relationship, setRelationship] = useState<RelationshipType>("love");
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

  const runCompare = useCallback(async (rel: RelationshipType) => {
    setSubmitting(true);
    setError(null);
    setLlmText(null);
    try {
      const payloadA = buildPayload(formA);
      const payloadB = buildPayload(formB);
      const response = await fetch("/api/bazi/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personA: payloadA, personB: payloadB, relationship: rel }),
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

  const canCompare = isFormComplete(formA) && isFormComplete(formB);

  const onCompare = useCallback(() => runCompare(relationship), [runCompare, relationship]);

  /** เปลี่ยนความสัมพันธ์: อัปเดต state แล้วคำนวณใหม่ทันทีถ้ากรอกครบ. */
  const onChangeRelationship = useCallback(
    (rel: RelationshipType) => {
      setRelationship(rel);
      setLlmText(null);
      if (canCompare) void runCompare(rel);
    },
    [canCompare, runCompare],
  );

  const meta = RELATIONSHIP_META[relationship];
  const domain = meta.domain;
  const facets = result?.facets ?? [];
  const main = result?.mainFacet ?? null;
  const matchFound = facets.some((f) => f.found);

  const onRephrase = useCallback(async () => {
    if (!result) return;
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
          engineText: buildFacetEngineText(result.relationship, result.facets, result.mainFacet, result.comparison),
          domainLabel: `ความเข้ากันแบบ${RELATIONSHIP_META[result.relationship].label}`,
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
  }, [result, provider, apiKey]);

  const sisingActiveCode = main?.sising?.code ?? null;
  const sisingRef = result?.comparison.sisingReference ?? [];

  const modalTitle = useMemo(() => {
    switch (modal) {
      case "chart": return "ผังธาตุ 2 คน";
      case "sising": return "12 สี่ซิ้ง (ดาวประจำดวง)";
      default: return "";
    }
  }, [modal]);

  const roles = result ? (result.relationship === "love" ? result.comparison.loveRoles : result.comparison.workRoles) : [];

  return (
    <div className="pair-shell">
      <Surface as="section" inset>
        <SectionHeading
          kicker="กรอกข้อมูล 2 คน"
          title="ตั้งวันเกิดของทั้งสองฝ่าย"
          note="ระบบใช้เวลาประเทศไทย + ปฏิทินสุริยคติ และจับคู่จากหลักวัน (วันเกิด) ของทั้งคู่"
        />
        <div className="pair-actions" style={{ marginBottom: "0.75rem" }}>
          <label className="field field--compact">
            <span>ความสัมพันธ์</span>
            <select
              value={relationship}
              onChange={(e) => onChangeRelationship(e.target.value as RelationshipType)}
            >
              {RELATIONSHIP_OPTIONS.map((rel) => (
                <option key={rel} value={rel}>{RELATIONSHIP_META[rel].label}</option>
              ))}
            </select>
          </label>
          <span className="pair-hint">{meta.ourLabel} ↔ {meta.partnerLabel} · ใช้ตาราง{DOMAIN_LABEL[domain]}</span>
        </div>
        <div className="pair-forms">
          <PersonInputs label={meta.ourLabel} form={formA} onChange={onChangeA} />
          <PersonInputs label={meta.partnerLabel} form={formB} onChange={onChangeB} />
        </div>
        <div className="pair-actions" style={{ marginTop: "1rem" }}>
          <ActionButton tone="primary" type="button" disabled={submitting || !canCompare} onClick={onCompare}>
            {submitting ? "กำลังคำนวณ..." : "เปรียบเทียบดวง"}
          </ActionButton>
          {!canCompare ? (
            <span className="pair-hint">กรอกวัน-เวลาเกิดของทั้งสองฝ่ายให้ครบก่อนจึงจะเปรียบเทียบได้</span>
          ) : null}
          {error ? <span className="pair-error">{error}</span> : null}
        </div>
      </Surface>

      {result ? (
        <Surface as="section" inset className="pair-result">
          {/* ── คำทำนายพื้นฐานรายคน ── */}
          <SectionHeading kicker="คำทำนายพื้นฐาน" title="หลักวัน & นิสัยของแต่ละคน" compact />
          <div className="pair-person-grid">
            {([
              { who: RELATIONSHIP_META[result.relationship].ourLabel, p: result.comparison.personA },
              { who: RELATIONSHIP_META[result.relationship].partnerLabel, p: result.comparison.personB },
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

          {/* ── เทียบสี่เสา 2 คน ── */}
          <SectionHeading kicker="ผังธาตุ" title="เทียบสี่เสาของทั้งสองฝ่าย" compact />
          <PairPillarsCompare personA={result.personA} personB={result.personB} />

          {/* ── ความเข้ากัน ── */}
          <SectionHeading
            kicker="ความเข้ากัน"
            title={`ดวงสมพงษ์แบบ${RELATIONSHIP_META[result.relationship].label}`}
            compact
          />

          {matchFound && main ? (
            <>
              {/* คำทำนายหลัก (มิติ ⭐ ตามที่ซินแสกำหนด) */}
              <div className="pair-verdict">
                <div className="pair-verdict__grade">{main.grade}</div>
                <div className="pair-verdict__main">
                  <div className="pair-verdict__label">{verdictLabel(main.percent)}</div>
                  <div className="pair-verdict__pct">
                    {main.label} {main.percent ?? "-"}%
                    {main.emoji ? <span className="pair-direction__emoji"> {main.emoji}</span> : null}
                  </div>
                  <div className="pair-hint">คำทำนายหลัก · {main.pairingLabel}</div>
                </div>
              </div>

              {facets.length ? <PairCompatBars facets={facets} /> : null}

              {/* รายละเอียดคำทำนายหลัก */}
              <div className="pair-direction">
                <p className="pair-rating-text">{main.ratingText}</p>
              </div>

              {/* คำทำนายรายมิติ (3 บรรทัดต่อแท่ง: ก้าน/กิ่ง/สี่ซิ้ง) */}
              <SectionHeading kicker="คำทำนายรายมิติ" title="รายละเอียดแต่ละแท่ง" compact />
              <PairFacetReadings facets={facets} />

              <div className="pair-elem">
                <strong>ปฏิกิริยาธาตุ {RELATIONSHIP_META[result.relationship].ourLabel} ({result.comparison.elementInteraction.aElementTh}) ↔ {RELATIONSHIP_META[result.relationship].partnerLabel} ({result.comparison.elementInteraction.bElementTh})</strong>
                <span>{result.comparison.elementInteraction.summaryTh}</span>
              </div>

              {/* สี่ซิ้งของมิติหลัก + คำทำนายพื้นฐานตามด้าน */}
              {main.sising ? (
                <div className="pair-sising-feature">
                  <div className="pair-sising-feature__title">
                    สี่ซิ้งมิติหลัก: {main.sising.nameTh}
                    <span className="pair-sising-card__score"> ({main.sising.nameCn} · พลัง {main.sising.score})</span>
                  </div>
                  <p className="pair-rating-text">{main.sising.long || main.sising.short}</p>
                  {sisingDomainAspects(main.sising, domain).map((a) => (
                    <p key={a.label} className="pair-rating-text"><strong>{a.label}:</strong> {a.text}</p>
                  ))}
                </div>
              ) : null}

              {/* บทบาทตามด้าน (inline) */}
              {roles.length ? (
                <div className="pair-roles">
                  <strong>บทบาทด้าน{DOMAIN_LABEL[domain]}</strong>
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
            <p className="pair-error">ไม่พบข้อมูลสมพงษ์สำหรับมิติหลักนี้ ({main?.ourGanzhi ?? "-"} × {main?.partnerGanzhi ?? "-"})</p>
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
              <SectionHeading kicker="ฉบับเรียบเรียง" title={`คำทำนายแบบ${RELATIONSHIP_META[result.relationship].label}`} compact />
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
                <SectionHeading kicker={RELATIONSHIP_META[result.relationship].ourLabel} title="พื้นดวง" compact />
                <ReadingChartFoundation calculatedState={result.personA} />
              </div>
              <div>
                <SectionHeading kicker={RELATIONSHIP_META[result.relationship].partnerLabel} title="พื้นดวง" compact />
                <ReadingChartFoundation calculatedState={result.personB} />
              </div>
            </div>
          ) : null}

          {modal === "sising" ? (
            <>
              <p className="pair-score-card__score">
                สี่ซิ้งของมิติหลักคือ <strong>{main?.sising?.nameTh ?? "-"}</strong> (เน้นกรอบ) — ตารางด้านล่างคือความหมายของทั้ง 12 ดาว
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
