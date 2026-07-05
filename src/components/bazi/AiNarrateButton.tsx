"use client";
/**
 * ปุ่ม "อ่านแบบ AI" กลาง — ส่ง engine-truth ไปเกลาเป็นคำทำนายอบอุ่นที่ /api/bazi/narrate
 * (ใช้คีย์เซิร์ฟเวอร์ ไม่ต้องกรอกคีย์). ใช้ซ้ำได้ทุกฟีเจอร์ที่มีผล engine อยู่แล้ว.
 */
import { useState } from "react";

export function AiNarrateButton({
  engineText,
  domainLabel,
  feature,
  label = "✨ อ่านแบบ AI",
}: {
  /** engine-truth ที่จะให้ AI เกลา (ถ้าว่าง ปุ่มจะ disabled) */
  engineText: string;
  /** ป้ายหัวข้อบอกบริบทให้ AI เช่น "เซียมซีใบที่ 5" */
  domainLabel: string;
  /** คีย์ฟีเจอร์สำหรับสถิติ/rate-limit เช่น "fortune_sage" */
  feature: string;
  label?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!engineText.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bazi/narrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ engineText, domainLabel, feature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "AI ตอบไม่สำเร็จ");
      setText(data.text ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI ตอบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-narrate">
      <button type="button" className="ai-narrate__btn" onClick={run} disabled={loading || !engineText.trim()}>
        {loading ? "กำลังอ่านแบบ AI…" : text ? "✨ อ่านแบบ AI อีกครั้ง" : label}
      </button>
      {error && <p className="ai-narrate__error">{error}</p>}
      {text && <div className="ai-narrate__prose">{text}</div>}
    </div>
  );
}
