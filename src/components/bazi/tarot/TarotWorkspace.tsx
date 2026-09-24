"use client";

import { useEffect, useMemo, useState } from "react";

type Card = {
  no: number;
  group: string;
  rank: string;
  name: string;
  virtue: string;
  tagline: string;
  meaning: string;
  caution: string;
  koan: string;
  universalUpright: string;
  universalReversed: string;
  integration: string;
};

type Slot = { position: number; role: string; no: number };

type PredictResult = {
  source: "engine" | "llm";
  cards: Card[];
  slots: Slot[];
  engineProse: string;
  llmProse?: string;
  model?: string;
};

const GROUP_LABEL: Record<string, string> = {
  major: "Major Arcana",
  pentacles: "เหรียญ (ดิน)",
  cups: "ถ้วย (น้ำ)",
  swords: "ดาบ (ลม)",
  wands: "ไม้ (ไฟ)",
};

const box: React.CSSProperties = {
  border: "1px solid #d8d2c4",
  borderRadius: 12,
  padding: 16,
  background: "#fbf9f4",
};

/** หน้าเทสต์ภายใน — ไพ่ทาโรต์วิถีเต๋า (ยังไม่ผูกแชท). self-contained inline styles */
export function TarotWorkspace() {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [count, setCount] = useState<1 | 3>(3);
  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const [result, setResult] = useState<PredictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmText, setLlmText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/tarot/predict")
      .then((r) => r.json())
      .then((body) => {
        if (active && Array.isArray(body.cards)) setAllCards(body.cards);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // สับลำดับไพ่ (ไม่โชว์ชื่อในโหมดเลือกเอง) — คงที่ต่อ session
  const shuffled = useMemo(() => {
    const a = [...allCards];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [allCards]);

  const byNo = useMemo(() => new Map(allCards.map((c) => [c.no, c])), [allCards]);

  function toggleSelect(no: number) {
    setSelected((prev) => {
      if (prev.includes(no)) return prev.filter((n) => n !== no);
      if (prev.length >= count) return prev;
      return [...prev, no];
    });
  }

  async function predict(body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    setLlmText(null);
    try {
      const res = await fetch("/api/tarot/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "อ่านไพ่ไม่สำเร็จ");
      setResult(data as PredictResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อ่านไพ่ไม่สำเร็จ");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function onDraw() {
    const q = question.trim() || undefined;
    if (mode === "random") {
      void predict({ random: true, mode: "engine", question: q, count });
    } else {
      if (selected.length !== count) {
        setError(`เลือกไพ่ให้ครบ ${count} ใบ`);
        return;
      }
      void predict({ cardNos: selected, mode: "engine", question: q });
    }
  }

  async function onAskLlm() {
    if (!result) return;
    setLlmLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tarot/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cardNos: result.cards.map((c) => c.no),
          mode: "llm",
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          question: question.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "LLM ตอบไม่สำเร็จ");
      setLlmText(data.llmProse ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "LLM ตอบไม่สำเร็จ");
    } finally {
      setLlmLoading(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 16, maxWidth: 860, margin: "0 auto" }}>
      <header>
        <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>
          🎴 ไพ่ทาโรต์วิถีเต๋า — The Oriental Charm Tarot
        </h1>
        <p style={{ margin: 0, color: "#6b6455", fontSize: 14 }}>
          78 ใบ (RWS + ปรัชญาเต๋า/กตัญญู) · สเปรด อดีต/ปัจจุบัน/อนาคต · หน้าเทสต์ภายใน (ยังไม่ผูกแชท)
        </p>
      </header>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#6b6455" }}>คำถาม (ไม่บังคับ)</span>
        <textarea
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="เช่น ความสัมพันธ์นี้จะไปทางไหน / งานที่กำลังตัดสินใจ"
          style={{ padding: 10, borderRadius: 8, border: "1px solid #d8d2c4", font: "inherit" }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setMode("random")} style={tab(mode === "random")}>
          🎲 สุ่ม
        </button>
        <button type="button" onClick={() => setMode("manual")} style={tab(mode === "manual")}>
          ✋ เลือกเอง
        </button>
        <span style={{ width: 1, height: 24, background: "#d8d2c4" }} />
        <button
          type="button"
          onClick={() => {
            setCount(3);
            setSelected([]);
          }}
          style={tab(count === 3)}
        >
          3 ใบ
        </button>
        <button
          type="button"
          onClick={() => {
            setCount(1);
            setSelected([]);
          }}
          style={tab(count === 1)}
        >
          1 ใบ
        </button>
      </div>

      {mode === "manual" && (
        <div style={box}>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6b6455" }}>
            จิตจดจ่อกับคำถาม แล้วเลือกไพ่ตามเลข (ไม่เห็นชื่อ) — เลือกแล้ว {selected.length}/{count}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
              gap: 6,
            }}
          >
            {shuffled.map((c) => {
              const active = selected.includes(c.no);
              const order = selected.indexOf(c.no);
              return (
                <button
                  key={c.no}
                  type="button"
                  onClick={() => toggleSelect(c.no)}
                  aria-label={`ไพ่ใบที่ ${c.no}`}
                  style={{
                    padding: "8px 4px",
                    borderRadius: 8,
                    border: active ? "2px solid #a67c2e" : "1px solid #d8d2c4",
                    background: active ? "#f6ecd4" : "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  #{c.no}
                  {active && <div style={{ fontSize: 10, color: "#a67c2e" }}>{order + 1}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={onDraw}
          disabled={loading}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: "#2f2a20",
            color: "#f6ecd4",
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          {loading ? "กำลังอ่าน…" : mode === "random" ? `🎲 จั่ว ${count} ใบ` : "🔮 อ่านไพ่ที่เลือก"}
        </button>
      </div>

      {error && <p style={{ color: "#b03a2e", margin: 0 }}>⚠️ {error}</p>}

      {result && (
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${result.cards.length}, 1fr)`,
              gap: 10,
            }}
          >
            {result.cards.map((card, i) => {
              const slot = result.slots[i];
              const full = byNo.get(card.no) ?? card;
              return (
                <article key={card.no} style={box}>
                  <div style={{ fontSize: 12, color: "#a67c2e", fontWeight: 600 }}>
                    {slot?.role} · {GROUP_LABEL[full.group] ?? full.group}
                  </div>
                  <h3 style={{ margin: "4px 0", fontSize: 15 }}>
                    {full.rank ? `${full.rank} · ` : ""}
                    {full.name}
                  </h3>
                  {full.virtue && (
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b6455" }}>{full.virtue}</p>
                  )}
                  <p style={{ margin: 0, fontSize: 13 }}>{full.tagline}</p>
                </article>
              );
            })}
          </div>

          <div style={box}>
            <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>คำอ่าน (engine)</h2>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7 }}>
              {result.engineProse}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#6b6455" }}>
                API key (Gemini) — ไม่บังคับ (ใส่เองเพื่อไม่จำกัดโควตา)
              </span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="วาง API key ที่นี่"
                style={{ padding: 10, borderRadius: 8, border: "1px solid #d8d2c4", font: "inherit" }}
              />
            </label>
            <div>
              <button
                type="button"
                onClick={onAskLlm}
                disabled={llmLoading}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid #a67c2e",
                  background: "#f6ecd4",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {llmLoading ? "กำลังเกลาคำ…" : "✨ ตอบแบบ LLM (เกลาคำ)"}
              </button>
            </div>
            {llmText && (
              <div style={box}>
                <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>คำอ่าน (เกลาด้วย LLM)</h2>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7 }}>{llmText}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function tab(active: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 999,
    border: active ? "2px solid #a67c2e" : "1px solid #d8d2c4",
    background: active ? "#f6ecd4" : "#fff",
    cursor: "pointer",
    fontSize: 14,
  };
}
