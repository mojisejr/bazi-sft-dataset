"use client";

import { useState } from "react";

type PairMeaning = {
  pair: string;
  feeling: string;
  work: string;
  money: string;
  love: string;
  analysis: string;
};

type Zone = "self" | "near" | "far";

type Pair = { pair: string; key: string; a: number; b: number; meaning: PairMeaning };

type DigitInfo = { digit: number; planet: string; element: string; keyword: string };

type Layer = {
  layerNo: number;
  digits: number[];
  digitString: string;
  zone: Zone;
  pairs: Pair[];
  digitMeaning?: DigitInfo;
};

type Reading = {
  input: string;
  normalized: string;
  rows: number[][];
  layers: Layer[];
};

const ZONE_LABEL: Record<Zone, string> = {
  self: "ตัวเรา (ชั้น 1-4)",
  near: "สิ่งแวดล้อมใกล้ตัว (ชั้น 5-6)",
  far: "สิ่งแวดล้อมห่างตัว (ชั้น 7-11)",
};

const MEANING_FIELDS: { key: keyof PairMeaning; label: string }[] = [
  { key: "feeling", label: "นึกคิด / บุคลิก" },
  { key: "work", label: "การงาน" },
  { key: "money", label: "การเงิน" },
  { key: "love", label: "ความรัก" },
  { key: "analysis", label: "บทวิเคราะห์" },
];

function zoneOfLayerNo(no: number): Zone {
  if (no <= 4) return "self";
  if (no <= 6) return "near";
  return "far";
}

export function HoneycombWorkspace() {
  const [phone, setPhone] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmText, setLlmText] = useState<string | null>(null);

  async function onRead() {
    setLoading(true);
    setError(null);
    setLlmText(null);
    try {
      const res = await fetch("/api/honeycomb/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "คำนวณไม่สำเร็จ");
      setReading(data as Reading);
    } catch (e) {
      setError(e instanceof Error ? e.message : "คำนวณไม่สำเร็จ");
      setReading(null);
    } finally {
      setLoading(false);
    }
  }

  async function onNarrate() {
    if (!reading) return;
    if (!apiKey.trim()) {
      setError("กรอก API key ก่อนเรียบเรียงด้วย AI");
      return;
    }
    setLlmLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/honeycomb/narrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: reading.input, apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "AI ตอบไม่สำเร็จ");
      setLlmText(data.llmProse ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI ตอบไม่สำเร็จ");
    } finally {
      setLlmLoading(false);
    }
  }

  return (
    <section className="honeycomb">
      <header className="honeycomb__intro">
        <h1 className="honeycomb__title">🐝 เบอร์รังผึ้ง — เบอร์ปิรามิด</h1>
        <p className="honeycomb__lead">
          กรอกเบอร์มือถือ ระบบสร้างสามเหลี่ยมปาสคาล (รวมเลขคู่ติดกันให้เหลือหลักเดียวไล่ลงจนถึงยอด)
          แล้วอ่านพลังงานรายชั้น — ชั้น 1-4 ตัวเรา · ชั้น 5-6 คนใกล้ตัว · ชั้น 7-11 คนห่างตัว
        </p>
      </header>

      <div className="honeycomb__form">
        <input
          type="tel"
          inputMode="numeric"
          className="honeycomb__input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="เช่น 0929949294"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) void onRead();
          }}
        />
        <button type="button" className="honeycomb__submit" onClick={onRead} disabled={loading}>
          {loading ? "กำลังคำนวณ…" : "🐝 สร้างปิรามิด"}
        </button>
      </div>

      {error && <p className="honeycomb__error">⚠️ {error}</p>}

      {reading && (
        <div className="honeycomb__result">
          {/* ภาพปิรามิด */}
          <div className="honeycomb__pyramid" aria-label="ปิรามิดของเบอร์">
            {reading.rows.map((row, i) => {
              const layerNo = reading.rows.length - i;
              const zone = zoneOfLayerNo(layerNo);
              return (
                <div key={layerNo} className={`honeycomb__row honeycomb__row--${zone}`}>
                  <span className="honeycomb__row-label">ชั้น {layerNo}</span>
                  {row.map((d, j) => (
                    <span key={j} className="honeycomb__cell">
                      {d}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>

          {/* คำอ่านรายชั้น */}
          <div className="honeycomb__layers">
            {[...reading.layers]
              .sort((a, b) => b.layerNo - a.layerNo)
              .map((layer) => (
                <details key={layer.layerNo} className={`honeycomb__layer honeycomb__layer--${layer.zone}`}>
                  <summary>
                    <span className="honeycomb__layer-no">ชั้น {layer.layerNo}</span>
                    <span className="honeycomb__layer-digits">{layer.digitString}</span>
                    <span className="honeycomb__layer-zone">{ZONE_LABEL[layer.zone]}</span>
                  </summary>

                  {layer.digitMeaning ? (
                    <dl className="honeycomb__meaning">
                      <div className="honeycomb__meaning-row">
                        <dt>ยอดปิรามิด — เลข {layer.digitMeaning.digit}</dt>
                        <dd>
                          {layer.digitMeaning.keyword} ({layer.digitMeaning.planet} · ธาตุ
                          {layer.digitMeaning.element})
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    layer.pairs.map((p, idx) => (
                      <div key={idx} className="honeycomb__pair">
                        <p className="honeycomb__pair-code">คู่ {p.pair}</p>
                        <dl className="honeycomb__meaning">
                          {MEANING_FIELDS.map((f) =>
                            p.meaning[f.key] ? (
                              <div key={f.key} className="honeycomb__meaning-row">
                                <dt>{f.label}</dt>
                                <dd>{p.meaning[f.key]}</dd>
                              </div>
                            ) : null,
                          )}
                        </dl>
                      </div>
                    ))
                  )}
                </details>
              ))}
          </div>

          {/* ปุ่ม AI เสริม */}
          <div className="honeycomb__llm">
            <label className="honeycomb__field">
              <span>API key (Gemini) — สำหรับเรียบเรียงคำอ่านด้วย AI</span>
              <input
                type="password"
                className="honeycomb__input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="วาง API key ที่นี่"
              />
            </label>
            <button
              type="button"
              className="honeycomb__llm-btn"
              onClick={onNarrate}
              disabled={llmLoading}
            >
              {llmLoading ? "กำลังเรียบเรียง…" : "✨ เรียบเรียงคำอ่าน (AI)"}
            </button>
            {llmText && (
              <div className="honeycomb__answer">
                <h2 className="honeycomb__answer-head">คำอ่านโดยซินแส (เรียบเรียงด้วย AI)</h2>
                <div className="honeycomb__prose">{llmText}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
