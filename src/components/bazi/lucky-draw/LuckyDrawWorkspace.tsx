"use client";

// หน้าหลังบ้าน "จั่วทีละใบ" (Lucky draw) — ซินแสนุ้ย 2026-09-28: กดเปิดทีละใบ ซินแสอ่านเอง.
// generic ใช้ได้ทั้งไพ่อาถรรพ์ฮวงจุ้ย (78) และเซียมซี (80): สับสำรับ → กด "เปิดไพ่" ทีละใบ ไม่ซ้ำจนหมดสำรับ
// → กด "สับใหม่" เริ่มรอบใหม่. ไม่มีคำถาม/LLM (ซินแสบอกว่า "กดทีละใบพอ"). inline styles self-contained.
import { useState } from "react";

export type DrawField = { label: string; value: string };
export type DrawCard = { no: number; name: string; fields: DrawField[] };

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const box: React.CSSProperties = {
  border: "1px solid #d8d2c4",
  borderRadius: 12,
  padding: 16,
  background: "#fbf9f4",
};

export function LuckyDrawWorkspace({
  title,
  subtitle,
  deck,
  accent = "#a67c2e",
}: {
  title: string;
  subtitle: string;
  deck: readonly DrawCard[];
  accent?: string;
}) {
  // สำรับที่สับแล้ว (ยังไม่เปิด) + ใบที่เปิดไปแล้ว (ล่าสุดอยู่ท้าย). สับตอน mount ฝั่ง client เท่านั้น
  // ไม่โชว์ลำดับสำรับก่อนเปิด → ไม่มี hydration mismatch (ก่อนเปิดใบแรก drawn ว่างเปล่า)
  const [pile, setPile] = useState<DrawCard[]>(() => shuffle(deck));
  const [drawn, setDrawn] = useState<DrawCard[]>([]);
  const current = drawn[drawn.length - 1] ?? null;
  const empty = pile.length === 0;

  function draw() {
    if (empty) return;
    setDrawn((d) => [...d, pile[pile.length - 1]]);
    setPile((p) => p.slice(0, -1));
  }
  function reset() {
    setPile(shuffle(deck));
    setDrawn([]);
  }

  return (
    <section style={{ display: "grid", gap: 16, maxWidth: 720, margin: "0 auto" }}>
      <header>
        <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>{title}</h1>
        <p style={{ margin: 0, color: "#6b6455", fontSize: 14 }}>{subtitle}</p>
      </header>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={draw}
          disabled={empty}
          style={{
            padding: "12px 26px",
            borderRadius: 10,
            border: "none",
            background: empty ? "#bdb7a6" : "#2f2a20",
            color: "#f6ecd4",
            cursor: empty ? "default" : "pointer",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {empty ? "หมดสำรับแล้ว" : drawn.length === 0 ? "🎴 เปิดไพ่ใบแรก" : "🎴 เปิดไพ่ใบถัดไป"}
        </button>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: `1px solid ${accent}`,
            background: "#f6ecd4",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          🔀 สับใหม่
        </button>
        <span style={{ fontSize: 13, color: "#6b6455" }}>
          เปิดไปแล้ว {drawn.length}/{deck.length} ใบ · เหลือ {pile.length} ใบ
        </span>
      </div>

      {current ? (
        <article style={{ ...box, borderColor: accent }}>
          <div style={{ fontSize: 13, color: accent, fontWeight: 700 }}>ไพ่ใบที่ {current.no}</div>
          <h2 style={{ margin: "4px 0 12px", fontSize: 20 }}>{current.name}</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {current.fields
              .filter((f) => f.value && f.value.trim())
              .map((f) => (
                <div key={f.label}>
                  <div style={{ fontSize: 12, color: "#a67c2e", fontWeight: 600, marginBottom: 2 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{f.value}</div>
                </div>
              ))}
          </div>
        </article>
      ) : (
        <p style={{ margin: 0, color: "#6b6455", fontSize: 14 }}>กด “เปิดไพ่ใบแรก” เพื่อเริ่มจั่ว</p>
      )}

      {drawn.length > 1 && (
        <div style={box}>
          <div style={{ fontSize: 13, color: "#6b6455", marginBottom: 6 }}>ลำดับที่เปิดไปแล้ว</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {drawn.map((c, i) => (
              <span
                key={`${c.no}-${i}`}
                title={c.name}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: i === drawn.length - 1 ? `2px solid ${accent}` : "1px solid #d8d2c4",
                  background: i === drawn.length - 1 ? "#f6ecd4" : "#fff",
                  fontSize: 12,
                }}
              >
                {i + 1}. #{c.no} {c.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
