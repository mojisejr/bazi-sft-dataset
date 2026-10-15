"use client";

// หลังบ้านไพ่เซียมซีเคี้ยงคุง 80 ใบ: ถามเรื่องชี้แนะ/แผนงาน/ตัดสินใจ/ขอความเห็น แล้วเสี่ยง 1 ใบ (ซินแสนุ้ย 2026-10-15)
// "ตอบแบบแชท" = สูตรเดียวกับแชทหน้าบ้าน (เสี่ยวมู่/เสี่ยวมี่ ไม่เอ่ยถึงไพ่) · "สรุปคำทำนาย" = แบบหน้าเปิดไพ่
// ผ่าน /api/siamsi-kiangkung/predict (mode llm). inline styles self-contained (มิเรอร์ FengshuiAsk)
import { useState } from "react";

type Card = { no: number; name: string; theme: string; situation: string; caution: string; advice: string; imageUrl: string | null };
type Result = { card: Card; answer?: string | null; summary?: string | null; source?: string };

const box: React.CSSProperties = { border: "1px solid #cfe0d6", borderRadius: 12, padding: 16, background: "#f6fbf8" };
const pill = (on: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid #2e7d5b",
  background: on ? "#2e7d5b" : "#fff",
  color: on ? "#fff" : "#1f2a24",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
});

export function SiamsiAsk() {
  const [question, setQuestion] = useState("");
  const [persona, setPersona] = useState<"mu" | "mi">("mu");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function draw(style: "chat" | "summary") {
    setLoading(true);
    setError(null);
    try {
      const q = question.trim();
      const llm = style === "summary" || Boolean(q);
      const res = await fetch("/api/siamsi-kiangkung/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ random: true, persona, style, mode: llm ? "llm" : "engine", question: q || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "เสี่ยงไพ่ไม่สำเร็จ");
      setResult(data as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เสี่ยงไพ่ไม่สำเร็จ");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const text = result?.answer ?? result?.summary ?? null;

  return (
    <section style={{ display: "grid", gap: 14, maxWidth: 720, margin: "0 auto" }}>
      <header>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>💬 ถามเรื่องชี้แนะ / แผนงาน / ตัดสินใจ / ขอความเห็น</h2>
        <p style={{ margin: 0, color: "#55665c", fontSize: 13 }}>
          พิมพ์คำถาม แล้วเสี่ยง 1 ใบ — &quot;ตอบแบบแชท&quot; ใช้สูตรเดียวกับแชทเสี่ยวมู่/เสี่ยวมี่ (ไม่เอ่ยถึงไพ่) · &quot;สรุปคำทำนาย&quot; แบบหน้าเปิดไพ่
        </p>
      </header>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={2}
        placeholder="เช่น ควรลาออกจากงานตอนนี้ไหม / แผนเปิดร้านกาแฟดีไหม"
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #cfe0d6", fontSize: 14 }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" disabled={loading} onClick={() => draw("chat")} style={pill(true)}>
          💬 ตอบแบบแชท
        </button>
        <button type="button" disabled={loading} onClick={() => draw("summary")} style={pill(false)}>
          📜 สรุปคำทำนาย
        </button>
        <span style={{ marginLeft: 6, fontSize: 12, color: "#55665c" }}>คนตอบ:</span>
        <button type="button" onClick={() => setPersona("mu")} style={pill(persona === "mu")}>เสี่ยวมู่ (ครับ)</button>
        <button type="button" onClick={() => setPersona("mi")} style={pill(persona === "mi")}>เสี่ยวมี่ (ค่ะ)</button>
        {loading && <span style={{ fontSize: 13 }}>กำลังเสี่ยง…</span>}
      </div>
      {error && <p style={{ margin: 0, color: "#b3261e", fontSize: 13 }}>{error}</p>}

      {result && (
        <>
          {text && (
            <div style={{ ...box, borderColor: "#2e7d5b" }}>
              <div style={{ fontSize: 12, color: "#2e7d5b", fontWeight: 700, marginBottom: 6 }}>
                {result.answer ? `คำตอบ (${persona === "mu" ? "เสี่ยวมู่" : "เสี่ยวมี่"})` : "สรุปคำทำนาย"}
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7 }}>{text}</div>
            </div>
          )}
          <article style={box}>
            <div style={{ fontSize: 13, color: "#2e7d5b", fontWeight: 700 }}>เลข {result.card.no}</div>
            <h3 style={{ margin: "4px 0 10px", fontSize: 18 }}>{result.card.name}</h3>
            {result.card.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.card.imageUrl} alt={result.card.name} style={{ display: "block", width: 160, borderRadius: 12, margin: "0 0 12px" }} />
            )}
            {[
              ["แก่นของไพ่", result.card.theme],
              ["สถานการณ์", result.card.situation],
              ["ข้อควรระวัง", result.card.caution],
              ["คำแนะนำ", result.card.advice],
            ].map(([label, t]) =>
              t ? (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#2e7d5b", fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{t}</div>
                </div>
              ) : null,
            )}
          </article>
        </>
      )}
    </section>
  );
}
