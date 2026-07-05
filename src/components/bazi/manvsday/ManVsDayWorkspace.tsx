"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { AiNarrateButton } from "@/components/bazi/AiNarrateButton";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import { MascotBadge } from "@/components/bazi/reading/MascotBadge";
import { PairCompatBars } from "@/components/bazi/pair/PairCompatBars";
import { PairFacetReadings } from "@/components/bazi/pair/PairFacetReadings";
import { PersonInputs } from "@/components/bazi/pair/PersonInputs";
import { verdictLabel } from "@/components/bazi/pair/pair-presentation";
import { ManVsDayCalendar } from "@/components/bazi/manvsday/ManVsDayCalendar";
import { ManVsDayYearPrint } from "@/components/bazi/manvsday/ManVsDayYearPrint";
import { ChartPillarTable, type PillarColumnData } from "@/components/bazi/reading/ChartPillarTable";
import type { PillarValue } from "@/lib/bazi/schema-types";
import type { ManVsDayDaySummary, ManVsDayMonth } from "@/lib/bazi/manvsday";
import {
  applyFormFieldChange,
  buildPayload,
  createDefaultFormState,
  formStateFromRawInput,
  isFormComplete,
  type FormState,
} from "@/lib/bazi/trainer-workspace";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import type { ElementInteractionAB, MatchFacet } from "@/lib/bazi/pair-types";

type AlmanacBlock = {
  weekday: string;
  officer: string | null;
  officerDesc: string | null;
  jianchu: { name: string; meaning: string } | null;
  colors: { element: string; colors: string }[];
  luckyDirection: string | null;
  luckyHours: { god: string; range: string }[];
  gates: { name: string; meaning: string | null }[];
  dayStrength: number;
};

type ManVsDayResponse = {
  person: CalculatedStateValue;
  date: string;
  dayGanzhi: string;
  facets: MatchFacet[];
  mainFacet: MatchFacet | null;
  overallPercent: number | null;
  verdict: "good" | "neutral" | "caution";
  summary: string;
  summaryHeadline: string;
  summaryItems: { key: string; icon: string; label: string; text: string }[];
  elementRelation: ElementInteractionAB;
  almanac: AlmanacBlock;
  dayChart: {
    day: { stem: string; branch: string };
    month: { stem: string; branch: string };
    year: { stem: string; branch: string };
  };
};

const VERDICT_EMOJI: Record<ManVsDayResponse["verdict"], string> = {
  good: "✅",
  neutral: "➖",
  caution: "⚠️",
};

/** วันนี้ในรูป YYYY-MM-DD (โซนเครื่องผู้ใช้). */
function todayISO(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** YYYY-MM ของ ISO date. */
function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ManVsDayWorkspace() {
  const [form, setForm] = useState<FormState>(createDefaultFormState);
  const [date, setDate] = useState<string>(todayISO);
  const [month, setMonth] = useState<string>(() => monthOf(todayISO()));
  const [submitting, setSubmitting] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManVsDayResponse | null>(null);
  const [monthDays, setMonthDays] = useState<ManVsDayDaySummary[] | null>(null);
  const [yearData, setYearData] = useState<{ year: number; months: ManVsDayMonth[]; dayLabel: string } | null>(null);
  const [loadingYear, setLoadingYear] = useState(false);
  const [savedCharts, setSavedCharts] = useState<{ id: string; label: string; dayMaster: string | null }[]>([]);

  const refreshSaved = useCallback(async () => {
    try {
      const res = await fetch("/api/bazi/saved-charts");
      const data = await res.json();
      setSavedCharts(data.charts ?? []);
    } catch {
      /* DB ล่ม — ป้อนสดได้อยู่ */
    }
  }, []);

  useEffect(() => { void refreshSaved(); }, [refreshSaved]);

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((cur) => applyFormFieldChange(cur, e.target.name, e.target.value));
  }, []);

  const canRun = isFormComplete(form) && date.length > 0;

  const onRun = useCallback(async (dateArg?: string) => {
    const useDate = dateArg ?? date;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/bazi/man-vs-day", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ person: buildPayload(form), date: useDate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "คำนวณไม่สำเร็จ");
      setResult(data as ManVsDayResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }, [form, date]);

  const loadMonth = useCallback(async (ym: string) => {
    if (!isFormComplete(form)) return;
    setLoadingMonth(true);
    setError(null);
    try {
      const response = await fetch("/api/bazi/man-vs-day", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ person: buildPayload(form), month: ym }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "โหลดปฏิทินไม่สำเร็จ");
      setMonth(ym);
      setMonthDays(data.days as ManVsDayDaySummary[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoadingMonth(false);
    }
  }, [form]);

  const onSelectDay = useCallback((iso: string) => {
    setDate(iso);
    void onRun(iso);
  }, [onRun]);

  /** โหลดปฏิทินทั้งปีแล้วเปิดหน้าต่างพิมพ์ (บันทึกเป็น PDF ขาย). */
  const onPrintYear = useCallback(async () => {
    if (!isFormComplete(form)) return;
    setLoadingYear(true);
    setError(null);
    try {
      const yearCE = Number(month.split("-")[0]);
      const response = await fetch("/api/bazi/man-vs-day", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ person: buildPayload(form), year: yearCE }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "สร้างปฏิทินรายปีไม่สำเร็จ");
      const pd = data.person?.fourPillars?.day;
      setYearData({
        year: data.year as number,
        months: data.months as ManVsDayMonth[],
        dayLabel: pd ? `${pd.stem}${pd.branch}` : "-",
      });
      // รอ render แล้วค่อยสั่งพิมพ์
      setTimeout(() => window.print(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoadingYear(false);
    }
  }, [form, month]);

  /** บันทึกดวงปัจจุบันเข้า DB (ตั้งชื่อ). */
  const onSaveChart = useCallback(async () => {
    if (!isFormComplete(form)) return;
    const label = window.prompt("ตั้งชื่อดวงนี้ (เช่น ชื่อลูกค้า):");
    if (!label?.trim()) return;
    setError(null);
    try {
      const pd = result?.person.fourPillars?.day;
      const res = await fetch("/api/bazi/saved-charts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          rawInput: buildPayload(form),
          dayMaster: pd ? `${pd.stem}${pd.branch}` : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "บันทึกไม่สำเร็จ");
      await refreshSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }, [form, result, refreshSaved]);

  /** โหลดดวงที่บันทึกไว้กลับเข้าฟอร์ม. */
  const onLoadChart = useCallback(async (id: string) => {
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(`/api/bazi/saved-charts?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "โหลดไม่สำเร็จ");
      setForm(formStateFromRawInput(data.chart.rawInput));
      setResult(null);
      setMonthDays(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    }
  }, []);

  const onDeleteChart = useCallback(async (id: string) => {
    if (!window.confirm("ลบดวงที่บันทึกไว้นี้?")) return;
    try {
      await fetch(`/api/bazi/saved-charts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await refreshSaved();
    } catch {
      /* ignore */
    }
  }, [refreshSaved]);

  const facets = result?.facets ?? [];
  const main = result?.mainFacet ?? null;
  const matchFound = facets.some((f) => f.found);
  const day = result?.person.fourPillars?.day;

  return (
    <div className="pair-shell">
      <Surface as="section" inset>
        <SectionHeading
          kicker="ดวงเจ้าของ × วันจากปฏิทิน"
          title="ดูว่าวันนี้/วันที่เลือกเป็นอย่างไรกับดวงคนนี้"
          note="ใช้เวลาประเทศไทย + ปฏิทินสุริยคติ จับหลักวันของเจ้าของกับเสาวันของวันที่เลือก"
        />
        {savedCharts.length ? (
          <div className="pair-actions" style={{ marginBottom: "0.75rem" }}>
            <label className="field field--compact">
              <span>ดวงที่บันทึกไว้</span>
              <select defaultValue="" onChange={(e) => { void onLoadChart(e.target.value); e.target.value = ""; }}>
                <option value="" disabled>— เลือกดวงลูกค้า —</option>
                {savedCharts.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}{c.dayMaster ? ` · ${c.dayMaster}` : ""}</option>
                ))}
              </select>
            </label>
            <select defaultValue="" onChange={(e) => { if (e.target.value) void onDeleteChart(e.target.value); e.target.value = ""; }}>
              <option value="">🗑️ ลบดวง...</option>
              {savedCharts.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="pair-forms">
          <PersonInputs label="ดวงเจ้าของ" form={form} onChange={onChange} />
          <label className="field field--compact">
            <span>วันที่ต้องการดู</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="pair-actions" style={{ marginTop: "1rem" }}>
          <ActionButton tone="primary" type="button" disabled={submitting || !canRun} onClick={() => onRun()}>
            {submitting ? "กำลังคำนวณ..." : "ดูดวงกับวันนี้"}
          </ActionButton>
          <ActionButton type="button" disabled={loadingMonth || !isFormComplete(form)} onClick={() => loadMonth(month)}>
            {loadingMonth ? "กำลังโหลด..." : "ดูปฏิทินทั้งเดือน"}
          </ActionButton>
          <ActionButton type="button" disabled={!isFormComplete(form)} onClick={onSaveChart}>
            💾 บันทึกดวงนี้
          </ActionButton>
          {!canRun ? <span className="pair-hint">กรอกวัน-เวลาเกิดและเลือกวันที่ให้ครบก่อน</span> : null}
          {error ? <span className="pair-error">{error}</span> : null}
        </div>
      </Surface>

      {monthDays ? (
        <Surface as="section" inset className="pair-result">
          <div className="mvd-calendar__nav">
            <ActionButton type="button" disabled={loadingMonth} onClick={() => loadMonth(shiftMonth(month, -1))}>‹ เดือนก่อน</ActionButton>
            <SectionHeading
              kicker="ปฏิทินส่วนตัว"
              title={`${TH_MONTHS[Number(month.split("-")[1]) - 1]} ${Number(month.split("-")[0]) + 543}`}
              compact
            />
            <ActionButton type="button" disabled={loadingMonth} onClick={() => loadMonth(shiftMonth(month, 1))}>เดือนถัดไป ›</ActionButton>
          </div>
          <ManVsDayCalendar days={monthDays} selectedDate={result?.date ?? date} onSelectDay={onSelectDay} />
          <div className="pair-actions" style={{ marginTop: "0.75rem" }}>
            <ActionButton tone="primary" type="button" disabled={loadingYear} onClick={onPrintYear}>
              {loadingYear ? "กำลังสร้างปฏิทินทั้งปี..." : `📄 พิมพ์ปฏิทินทั้งปี ${Number(month.split("-")[0]) + 543} (บันทึก PDF)`}
            </ActionButton>
          </div>
        </Surface>
      ) : null}

      {result ? (
        <Surface as="section" inset className="pair-result">
          <SectionHeading
            kicker={`${result.almanac.weekday} · ${result.date}`}
            title={`ดวงวันนี้: เสาวัน ${result.dayGanzhi}`}
            compact
          />

          {/* ตารางสี่เสา (reuse ChartPillarTable — มีสีธาตุ/กรอบ): MAN | DAY */}
          {(() => {
            const fp = result.person.fourPillars;
            const asPillar = (p: { stem: string; branch: string }) => p as unknown as PillarValue;
            const manCols: PillarColumnData[] = [
              { label: "ยาม", pillar: fp?.hour },
              { label: "วัน", pillar: fp?.day },
              { label: "เดือน", pillar: fp?.month },
              { label: "ปี", pillar: fp?.year },
            ];
            const dayCols: PillarColumnData[] = [
              { label: "วัน", pillar: asPillar(result.dayChart.day) },
              { label: "เดือน", pillar: asPillar(result.dayChart.month) },
              { label: "ปี", pillar: asPillar(result.dayChart.year) },
            ];
            return (
              <div className="mvd-charts">
                <div className="mvd-chart">
                  <div className="mvd-chart__title">MAN · เจ้าของดวง</div>
                  <ChartPillarTable cols={manCols} variant="chapter" />
                </div>
                <div className="mvd-chart">
                  <div className="mvd-chart__title">DAY · วันนี้</div>
                  <ChartPillarTable cols={dayCols} variant="chapter" />
                </div>
              </div>
            );
          })()}

          {/* หัวการ์ด: รูป mascot ใหญ่กลางบน → กล่องข้อมูลบรรทัดถัดไป */}
          <div className={`mvd-hero mvd-hero--${result.verdict}`}>
            {day ? (
              <div className="mvd-hero__mascot">
                <MascotBadge dayStem={day.stem} dayBranch={day.branch} />
              </div>
            ) : null}
            <div className="mvd-hero__box">
              <div className="mvd-hero__grade">{main?.grade ?? "-"}</div>
              <div className="mvd-hero__body">
                <div className="mvd-hero__verdict">
                  {VERDICT_EMOJI[result.verdict]} {verdictLabel(result.overallPercent)}
                </div>
                <div className="mvd-hero__pct">
                  เหมาะกับเราวันนี้ <b>{result.overallPercent ?? "-"}%</b>
                  <span> · กำลังวัน(ปฏิทิน) {Math.round(result.almanac.dayStrength * 100)}%</span>
                </div>
                <div className="mvd-hero__elem">
                  ดิถีเรา ({result.elementRelation.aElementTh}) มองพลังวัน ({result.elementRelation.bElementTh}) เป็น
                  “{result.elementRelation.aToB.labelTh}”
                </div>
              </div>
            </div>
          </div>

          {/* สรุปคำทำนายของวัน (แยกบรรทัด อ่านง่าย) */}
          <div className={`mvd-summary mvd-summary--${result.verdict}`}>
            <div className="mvd-summary__head">
              <span className="mvd-summary__icon">{VERDICT_EMOJI[result.verdict]}</span>
              <span className="mvd-summary__headline">{result.summaryHeadline}</span>
            </div>
            <ul className="mvd-summary__list">
              {result.summaryItems.map((it) => (
                <li key={it.key} className={`mvd-summary__item mvd-summary__item--${it.key}`}>
                  <span className="mvd-summary__item-icon">{it.icon}</span>
                  <span className="mvd-summary__item-label">{it.label}</span>
                  <span className="mvd-summary__item-text">{it.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <AiNarrateButton
            feature="man_vs_day"
            domainLabel="ดวงกับวันนี้"
            engineText={[
              result.summaryHeadline,
              result.summary,
              ...result.summaryItems.map((it) => `${it.label}: ${it.text}`),
            ].join("\n")}
          />

          {matchFound ? (
            <>
              <PairCompatBars facets={facets} emphasis="extremes" />
              <SectionHeading kicker="คำทำนายรายด้าน" title="แต่ละสถานการณ์ของวันนี้" compact />
              <PairFacetReadings facets={facets} />
            </>
          ) : (
            <p className="pair-error">ไม่พบข้อมูลสมพงษ์สำหรับวันนี้</p>
          )}

          {/* บล็อกปฏิทินย่อ */}
          <SectionHeading kicker="ข้อมูลปฏิทินของวัน" title="ดิถี · ยามมงคล · สี · ทิศ" compact />
          <div className="pair-elem">
            {result.almanac.officer ? (
              <span><strong>ดิถี:</strong> {result.almanac.officer}{result.almanac.officerDesc ? ` — ${result.almanac.officerDesc}` : ""}</span>
            ) : null}
            {result.almanac.jianchu ? (
              <span><strong>建除:</strong> {result.almanac.jianchu.name} — {result.almanac.jianchu.meaning}</span>
            ) : null}
            {result.almanac.luckyDirection ? (
              <span><strong>ทิศโชคลาภ:</strong> {result.almanac.luckyDirection}</span>
            ) : null}
            {result.almanac.colors.length ? (
              <span><strong>สีมงคล:</strong> {result.almanac.colors.map((c) => `${c.colors} (${c.element})`).join(", ")}</span>
            ) : null}
            {result.almanac.luckyHours.length ? (
              <span><strong>ยามมงคล:</strong> {result.almanac.luckyHours.slice(0, 6).map((h) => `${h.god} ${h.range}`).join(" · ")}</span>
            ) : null}
          </div>
        </Surface>
      ) : null}

      {yearData ? (
        <ManVsDayYearPrint
          year={yearData.year}
          ownerLabel="เจ้าของดวง"
          dayPillarLabel={yearData.dayLabel}
          months={yearData.months}
        />
      ) : null}
    </div>
  );
}
