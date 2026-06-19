"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import { ReadingChartFoundation } from "@/components/bazi/reading/ReadingChartFoundation";
import { PairDetailModal } from "@/components/bazi/pair/PairDetailModal";
import { PersonInputs } from "@/components/bazi/pair/PersonInputs";
import { WorkPrintReport } from "@/components/bazi/pair/WorkPrintReport";
import { sisingDomainAspects, verdictLabel, buildWorkEngineText } from "@/components/bazi/pair/pair-presentation";
import {
  applyFormFieldChange,
  buildPayload,
  createDefaultFormState,
  type FormState,
} from "@/lib/bazi/trainer-workspace";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";
import type { WorkComparisonResult } from "@/lib/bazi/pair-types";
import type { ReadingLlmProvider } from "@/lib/bazi/reading-llm";

const MAX_CANDIDATES = 3;
const SELF_LABEL = "เรา";

type WorkResponse = {
  self: CalculatedStateValue;
  candidates: CalculatedStateValue[];
  comparison: WorkComparisonResult;
};

type ModalKind = "chart" | "sising" | null;

function candidateName(names: string[], index: number): string {
  return names[index]?.trim() || `ผู้สมัครคนที่ ${index + 1}`;
}

/** กรอกวัน-เวลาครบทุกช่องหรือยัง (กันส่ง payload ที่ยังว่าง). */
function isFormComplete(f: FormState): boolean {
  return Boolean(f.birthDay && f.birthMonth && f.birthYearBe && f.birthHour && f.birthMinute);
}

export function WorkMatchingWorkspace() {
  const [selfForm, setSelfForm] = useState<FormState>(createDefaultFormState);
  const [candForms, setCandForms] = useState<FormState[]>(() => [
    { ...createDefaultFormState(), gender: "male" },
    { ...createDefaultFormState(), gender: "male" },
  ]);
  const [names, setNames] = useState<string[]>(["", ""]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WorkResponse | null>(null);
  const [submittedNames, setSubmittedNames] = useState<string[]>([]);
  const [submittedSelf, setSubmittedSelf] = useState<RawInputValue | null>(null);
  const [submittedCands, setSubmittedCands] = useState<RawInputValue[]>([]);
  const [dateText, setDateText] = useState("");
  const [currentYear, setCurrentYear] = useState(0);
  const [modal, setModal] = useState<ModalKind>(null);

  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<ReadingLlmProvider>("gemini");
  const [llmText, setLlmText] = useState<Record<number, string>>({});
  const [llmLoading, setLlmLoading] = useState<number | null>(null);

  const onChangeSelf = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSelfForm((cur) => applyFormFieldChange(cur, e.target.name, e.target.value));
  }, []);

  const onChangeCand = useCallback((index: number, e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCandForms((cur) => cur.map((f, i) => (i === index ? applyFormFieldChange(f, name, value) : f)));
  }, []);

  const addCandidate = useCallback(() => {
    setCandForms((cur) => (cur.length >= MAX_CANDIDATES ? cur : [...cur, { ...createDefaultFormState(), gender: "male" }]));
    setNames((cur) => (cur.length >= MAX_CANDIDATES ? cur : [...cur, ""]));
  }, []);

  const removeCandidate = useCallback((index: number) => {
    setCandForms((cur) => (cur.length <= 1 ? cur : cur.filter((_, i) => i !== index)));
    setNames((cur) => (cur.length <= 1 ? cur : cur.filter((_, i) => i !== index)));
  }, []);

  const onCompare = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setLlmText({});
    try {
      if (!isFormComplete(selfForm)) {
        throw new Error("กรอกวัน-เวลาเกิดของ “เรา” ให้ครบก่อน");
      }
      // ส่งเฉพาะผู้ร่วมงานที่กรอกครบ (ช่องที่เว้นว่างจะถูกข้าม)
      const filled = candForms
        .map((form, i) => ({ form, name: candidateName(names, i) }))
        .filter(({ form }) => isFormComplete(form));
      if (filled.length === 0) {
        throw new Error("กรอกข้อมูลผู้ร่วมงานอย่างน้อย 1 คนให้ครบก่อน");
      }

      const selfPayload = buildPayload(selfForm);
      const candPayloads = filled.map(({ form }) => buildPayload(form));
      const response = await fetch("/api/bazi/work", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ self: selfPayload, candidates: candPayloads }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "คำนวณไม่สำเร็จ");
      }
      setResult(data as WorkResponse);
      setSubmittedSelf(selfPayload);
      setSubmittedCands(candPayloads);
      setSubmittedNames(filled.map(({ name }) => name));
      const now = new Date();
      setCurrentYear(now.getFullYear());
      setDateText(now.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }, [selfForm, candForms, names]);

  const onRephrase = useCallback(async (index: number) => {
    if (!result) return;
    const candidate = result.comparison.candidates[index];
    if (!candidate) return;
    if (provider !== "anthropic" && apiKey.trim().length === 0) {
      setError("กรุณาใส่ API key ก่อนเรียบเรียงด้วย LLM");
      return;
    }
    setLlmLoading(index);
    setError(null);
    try {
      const candLabel = submittedNames[index] ?? `ผู้สมัครคนที่ ${index + 1}`;
      const response = await fetch("/api/bazi/pair/rephrase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          engineText: buildWorkEngineText(SELF_LABEL, candLabel, candidate),
          domainLabel: `ความเข้ากันด้านการงานกับ${candLabel}`,
          provider,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "เรียบเรียงไม่สำเร็จ");
      }
      setLlmText((cur) => ({ ...cur, [index]: data.text as string }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "เรียก LLM ไม่สำเร็จ");
    } finally {
      setLlmLoading(null);
    }
  }, [result, provider, apiKey, submittedNames]);

  const comparison = result?.comparison ?? null;
  const sisingRef = comparison?.sisingReference ?? [];

  const rankedCandidates = useMemo(() => {
    if (!comparison) return [];
    return comparison.ranking.map((idx, rank) => ({
      rank,
      candidate: comparison.candidates[idx],
      name: submittedNames[idx] ?? `ผู้สมัครคนที่ ${idx + 1}`,
    }));
  }, [comparison, submittedNames]);

  const modalTitle = modal === "chart" ? "ผังธาตุทุกคน" : modal === "sising" ? "12 สี่ซิ้ง (ดาวประจำดวง)" : "";

  return (
    <div className="pair-shell">
      <Surface as="section" inset>
        <SectionHeading
          kicker="เปรียบเทียบการงาน"
          title="กรอก “เรา” และผู้ร่วมงาน (หุ้นส่วน/ลูกน้อง) สูงสุด 3 คน"
          note="ระบบจับคู่หลักวันแบบแม่นตามตำราคู่สมพงษ์ (การงาน) แล้วจัดอันดับว่าใครเข้ากับเราดีที่สุด"
        />
        <div className="pair-forms">
          <PersonInputs label="เรา" form={selfForm} onChange={onChangeSelf} />
        </div>

        <SectionHeading kicker="ผู้ร่วมงาน" title="หุ้นส่วน / ลูกน้อง ที่จะเปรียบเทียบ" compact />
        <div className="pair-forms pair-forms--candidates">
          {candForms.map((form, index) => (
            <div key={index} className="pair-candidate-input">
              <label className="field field--compact">
                <span>ชื่อ/ฉายา (ไม่บังคับ)</span>
                <input
                  type="text"
                  value={names[index] ?? ""}
                  placeholder={`ผู้สมัครคนที่ ${index + 1}`}
                  onChange={(e) => setNames((cur) => cur.map((n, i) => (i === index ? e.target.value : n)))}
                />
              </label>
              <PersonInputs
                label={candidateName(names, index)}
                form={form}
                onChange={(e) => onChangeCand(index, e)}
                onRemove={candForms.length > 1 ? () => removeCandidate(index) : undefined}
              />
            </div>
          ))}
        </div>

        <div className="pair-actions" style={{ marginTop: "1rem" }}>
          {candForms.length < MAX_CANDIDATES ? (
            <ActionButton type="button" onClick={addCandidate}>+ เพิ่มผู้ร่วมงาน</ActionButton>
          ) : null}
          <ActionButton tone="primary" type="button" disabled={submitting} onClick={onCompare}>
            {submitting ? "กำลังคำนวณ..." : "เปรียบเทียบการงาน"}
          </ActionButton>
          {error ? <span className="pair-error">{error}</span> : null}
        </div>
      </Surface>

      {comparison ? (
        <Surface as="section" inset className="pair-result">
          {/* ── เรา ── */}
          <SectionHeading kicker="หลักวันของเรา" title={`${comparison.self.dayPillar.stem}${comparison.self.dayPillar.branch} · ดิถี${comparison.self.elementTh}${comparison.self.stageTh ? ` · ${comparison.self.stageTh}` : ""}`} compact />
          <ul className="pair-nisai-list">
            {comparison.self.nisai.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>

          {/* ── อันดับ ── */}
          <SectionHeading kicker="ผลจัดอันดับ" title="ใครเข้ากับเราดีที่สุด (ด้านการงาน)" compact />
          <ol className="pair-ranking">
            {rankedCandidates.map(({ rank, candidate, name }) => {
              const score = candidate.rankScore;
              const width = score == null ? 0 : Math.max(2, Math.min(100, score));
              return (
                <li key={candidate.index} className="pair-ranking__item" data-best={rank === 0 ? "true" : undefined}>
                  <span className="pair-ranking__pos">{rank === 0 ? "👑" : `#${rank + 1}`}</span>
                  <div className="pair-ranking__main">
                    <div className="pair-ranking__namerow">
                      <span className="pair-ranking__name">{name}</span>
                      <span className="pair-ranking__pillar">{candidate.profile.dayPillar.stem}{candidate.profile.dayPillar.branch}</span>
                    </div>
                    <span className="pair-ranking__bar">
                      <span className="pair-ranking__bar-fill" style={{ width: `${width}%` }} />
                    </span>
                  </div>
                  <span className="pair-ranking__score">{score ?? "-"}%</span>
                  <span className="pair-ranking__grade">{candidate.match.forward.grade}</span>
                </li>
              );
            })}
          </ol>
          <p className="pair-rating-text" style={{ opacity: 0.7 }}>
            * จัดอันดับจากคะแนนทิศ “เรา → ผู้ร่วมงาน” (forward) ตามตำราคู่สมพงษ์ด้านการงาน
          </p>

          {/* ── รายละเอียดแต่ละคน (เรียงตามอันดับ) ── */}
          {rankedCandidates.map(({ rank, candidate, name }) => {
            const f = candidate.match.forward;
            const r = candidate.match.reverse;
            const found = f.found || r.found;
            return (
              <div key={candidate.index} className="pair-candidate-card">
                <div className="pair-candidate-card__head">
                  <span className="pair-candidate-card__rank">{rank === 0 ? "👑 อันดับ 1" : `อันดับ ${rank + 1}`}</span>
                  <span className="pair-candidate-card__name">{name}</span>
                  <span className="pair-candidate-card__pillar">
                    {candidate.profile.dayPillar.stem}{candidate.profile.dayPillar.branch} · ดิถี{candidate.profile.elementTh}
                  </span>
                </div>

                {found ? (
                  <>
                    <div className="pair-verdict">
                      <div className="pair-verdict__grade">{f.grade}</div>
                      <div className="pair-verdict__main">
                        <div className="pair-verdict__label">{verdictLabel(f.percent)}</div>
                        <div className="pair-verdict__pct">เรา → {name}: {f.percent ?? "-"}% · เฉลี่ยสองทิศ {candidate.match.overallPercent ?? "-"}%</div>
                      </div>
                    </div>

                    <div className="pair-direction-grid">
                      {[
                        { dir: f, label: `เรา มอง ${name}` },
                        { dir: r, label: `${name} มอง เรา` },
                      ].map(({ dir, label }) => (
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
                      <strong>ปฏิกิริยาธาตุ เรา ({candidate.elementInteraction.aElementTh}) ↔ {name} ({candidate.elementInteraction.bElementTh})</strong>
                      <span>{candidate.elementInteraction.summaryTh}</span>
                    </div>

                    {f.sising ? (
                      <div className="pair-sising-feature">
                        <div className="pair-sising-feature__title">
                          สี่ซิ้งประจำคู่: {f.sising.nameTh}
                          <span className="pair-sising-card__score"> ({f.sising.nameCn} · พลัง {f.sising.score})</span>
                        </div>
                        <p className="pair-rating-text">{f.sising.long || f.sising.short}</p>
                        {sisingDomainAspects(f.sising, "work").map((a) => (
                          <p key={a.label} className="pair-rating-text"><strong>{a.label}:</strong> {a.text}</p>
                        ))}
                      </div>
                    ) : null}

                    {candidate.roles.length ? (
                      <div className="pair-roles">
                        <strong>บทบาทด้านการงาน</strong>
                        {candidate.roles.map((role, i) => (
                          <div key={i} className="pair-role">
                            <span className="pair-role__perspective">{role.perspective} · {role.stageName}</span>
                            <span>{role.narrative}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="pair-actions">
                      <ActionButton type="button" disabled={llmLoading === candidate.index} onClick={() => onRephrase(candidate.index)}>
                        {llmLoading === candidate.index ? "กำลังเรียบเรียง..." : "เรียบเรียงด้วย LLM"}
                      </ActionButton>
                    </div>
                    {llmText[candidate.index] ? (
                      <Surface as="div" inset>
                        <p className="pair-rating-text" style={{ whiteSpace: "pre-wrap" }}>{llmText[candidate.index]}</p>
                      </Surface>
                    ) : null}
                  </>
                ) : (
                  <p className="pair-error">ไม่พบข้อมูลสมพงษ์สำหรับคู่หลักวันนี้ ({f.ourPillar} × {f.partnerPillar})</p>
                )}
              </div>
            );
          })}

          <div className="pair-popup-buttons">
            <ActionButton type="button" onClick={() => setModal("chart")}>ดูผังธาตุทุกคน</ActionButton>
            <ActionButton type="button" onClick={() => setModal("sising")}>ดู 12 สี่ซิ้งทั้งหมด</ActionButton>
            <ActionButton tone="primary" type="button" onClick={() => window.print()}>
              บันทึกเป็น PDF / พิมพ์
            </ActionButton>
          </div>

          {/* ── ตั้งค่า LLM ── */}
          <SectionHeading kicker="เรียบเรียง" title="ตั้งค่า LLM (กดเรียบเรียงรายคนด้านบน)" compact />
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
          </div>
        </Surface>
      ) : null}

      {modal && result ? (
        <PairDetailModal title={modalTitle} onClose={() => setModal(null)}>
          {modal === "chart" ? (
            <div className="pair-charts">
              <div>
                <SectionHeading kicker="เรา" title="พื้นดวง" compact />
                <ReadingChartFoundation calculatedState={result.self} />
              </div>
              {result.candidates.map((state, i) => (
                <div key={i}>
                  <SectionHeading kicker={submittedNames[i] ?? `ผู้สมัครคนที่ ${i + 1}`} title="พื้นดวง" compact />
                  <ReadingChartFoundation calculatedState={state} />
                </div>
              ))}
            </div>
          ) : null}

          {modal === "sising" ? (
            <div className="pair-sising-grid">
              {sisingRef.map((s) => (
                <div key={s.code} className="pair-sising-card">
                  <div className="pair-sising-card__name">
                    {s.nameTh} <span className="pair-sising-card__score">({s.nameCn} · {s.score})</span>
                  </div>
                  <div>{s.short}</div>
                </div>
              ))}
            </div>
          ) : null}
        </PairDetailModal>
      ) : null}

      {result ? (
        <WorkPrintReport
          result={result}
          selfBirth={submittedSelf}
          candidateBirths={submittedCands}
          candidateNames={submittedNames}
          dateText={dateText}
          currentYear={currentYear}
        />
      ) : null}
    </div>
  );
}
