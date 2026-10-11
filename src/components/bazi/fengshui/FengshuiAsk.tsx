"use client";

// หลังบ้านไพ่อาถรรพ์ฮวงจุ้ย: สุ่ม 1 หรือ 3 ใบ + ถามเรื่องสถานที่ได้ (ซินแสนุ้ย 2026-10-07)
// คำตอบใช้ "สูตรเดียวกับแชทหน้าบ้าน" (เสี่ยวมู่/เสี่ยวมี่ + คำสั่งตอบฮวงจุ้ยเดียวกัน) ผ่าน /api/fengshui/predict. inline styles self-contained.
import { useState } from "react";

type Side = { name: string; meaning: string; caution: string; advice: string };
type Card = Side & { no: number; imageUrl: string | null; en: Side | null };
type Result = { cards: Card[]; answer?: string | null };

const box: React.CSSProperties = { border: "1px solid #d8d2c4", borderRadius: 12, padding: 16, background: "#fbf9f4" };
const pill = (on: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid #a67c2e",
  background: on ? "#a67c2e" : "#fff",
  color: on ? "#fff" : "#2f2a20",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
});

export function FengshuiAsk() {
  const [question, setQuestion] = useState("");
  const [persona, setPersona] = useState<"mu" | "mi">("mu");
  const [lang, setLang] = useState<"th" | "en">("th");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function draw(count: 1 | 3) {
    setLoading(true);
    setError(null);
    try {
      const q = question.trim();
      const res = await fetch("/api/fengshui/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ random: true, count, persona, mode: q ? "llm" : "engine", question: q || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "จั่วไพ่ไม่สำเร็จ");
      setResult(data as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "จั่วไพ่ไม่สำเร็จ");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const side = (c: Card): Side => (lang === "en" && c.en ? c.en : c);
  const labels = lang === "en" ? ["Meaning", "Caution", "Remedy"] : ["ความหมาย", "ข้อควรระวัง", "คำแนะนำแก้ไข"];

  return (
    <section style={{ display: "grid", gap: 14, maxWidth: 720, margin: "0 auto" }}>
      <header>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>💬 ถามเรื่องสถานที่ (สูตรเดียวกับแชทหน้าบ้าน)</h2>
        <p style={{ margin: 0, color: "#6b6455", fontSize: 13 }}>
          พิมพ์คำถาม (ไม่บังคับ) แล้วสุ่ม 1 หรือ 3 ใบ — ถ้ามีคำถาม เสี่ยวมู่/เสี่ยวมี่จะตอบจากไพ่ที่ได้ เหมือนในแชท
        </p>
      </header>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={2}
        placeholder="เช่น ห้องนอนฉันหันหน้าไปทางทิศตะวันตก ดีไหม"
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d8d2c4", fontSize: 14 }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" disabled={loading} onClick={() => draw(1)} style={pill(false)}>
          🎴 สุ่ม 1 ใบ
        </button>
        <button type="button" disabled={loading} onClick={() => draw(3)} style={pill(true)}>
          🎴🎴🎴 สุ่ม 3 ใบ
        </button>
        <span style={{ marginLeft: 6, fontSize: 12, color: "#6b6455" }}>คนตอบ:</span>
        <button type="button" onClick={() => setPersona("mu")} style={pill(persona === "mu")}>เสี่ยวมู่ (ครับ)</button>
        <button type="button" onClick={() => setPersona("mi")} style={pill(persona === "mi")}>เสี่ยวมี่ (ค่ะ)</button>
        <span style={{ marginLeft: 6, fontSize: 12, color: "#6b6455" }}>ไพ่:</span>
        <button type="button" onClick={() => setLang("th")} style={pill(lang === "th")}>ไทย</button>
        <button type="button" onClick={() => setLang("en")} style={pill(lang === "en")}>EN</button>
        {loading && <span style={{ fontSize: 13 }}>กำลังจั่ว…</span>}
      </div>
      {error && <p style={{ margin: 0, color: "#b3261e", fontSize: 13 }}>{error}</p>}

      {result && (
        <>
          {result.answer && (
            <div style={{ ...box, borderColor: "#a67c2e" }}>
              <div style={{ fontSize: 12, color: "#a67c2e", fontWeight: 700, marginBottom: 6 }}>
                คำตอบ ({persona === "mu" ? "เสี่ยวมู่" : "เสี่ยวมี่"})
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7 }}>{result.answer}</div>
            </div>
          )}
          <div style={{ display: "grid", gap: 12 }}>
            {result.cards.map((c, i) => {
              const v = side(c);
              return (
                <article key={c.no} style={box}>
                  <div style={{ fontSize: 13, color: "#a67c2e", fontWeight: 700 }}>
                    {lang === "en" ? `Card ${i + 1} · #${c.no}` : `ใบที่ ${i + 1} · เลข ${c.no}`}
                  </div>
                  <h3 style={{ margin: "4px 0 10px", fontSize: 18 }}>{v.name}</h3>
                  {c.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt={v.name} style={{ display: "block", width: "100%", maxWidth: 240, borderRadius: 12, margin: "0 0 12px" }} />
                  )}
                  {[v.meaning, v.caution, v.advice].map((t, k) =>
                    t ? (
                      <div key={labels[k]} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: "#a67c2e", fontWeight: 600 }}>{labels[k]}</div>
                        <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{t}</div>
                      </div>
                    ) : null,
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
