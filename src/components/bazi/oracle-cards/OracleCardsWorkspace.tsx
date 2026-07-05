"use client";

import { useEffect, useMemo, useState } from "react";

type Card = {
  no: number;
  name: string;
  keyword: string;
  meaning: string;
  book1: string;
  book2: string;
  imageUrl?: string | null;
};

type Slot = { position: number; weight: number; role: string; no: number };

type PredictResult = {
  source: "engine" | "llm";
  cards: Card[];
  slots: Slot[];
  engineProse: string;
  llmProse?: string;
  model?: string;
};

type ImageStatus = { total: number; done: number[] };

export function OracleCardsWorkspace() {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const [result, setResult] = useState<PredictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmText, setLlmText] = useState<string | null>(null);

  const [imageStatus, setImageStatus] = useState<ImageStatus | null>(null);

  // โหลดรายชื่อไพ่ทั้งหมด (โหมดเลือกเอง) + สถานะรูป
  useEffect(() => {
    let active = true;
    void fetch("/api/oracle-cards/predict")
      .then((r) => r.json())
      .then((body) => {
        if (active && Array.isArray(body.cards)) setAllCards(body.cards);
      })
      .catch(() => {});
    void fetch("/api/oracle-cards/images")
      .then((r) => r.json())
      .then((body) => {
        if (active && typeof body.total === "number") setImageStatus(body);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // จั่วปิดหน้า: สับลำดับไพ่ให้เลขไม่เรียง (คงที่ต่อ session) — ผู้เลือกไม่เห็นชื่อ
  const shuffled = useMemo(() => {
    const a = [...allCards];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [allCards]);

  function toggleSelect(no: number) {
    setSelected((prev) => {
      if (prev.includes(no)) return prev.filter((n) => n !== no);
      if (prev.length >= 3) return prev;
      return [...prev, no];
    });
  }

  async function predict(body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    setLlmText(null);
    try {
      const res = await fetch("/api/oracle-cards/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "ทำนายไม่สำเร็จ");
      setResult(data as PredictResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำนายไม่สำเร็จ");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function onDraw() {
    const q = question.trim() || undefined;
    if (mode === "random") {
      void predict({ random: true, mode: "engine", question: q });
    } else {
      if (selected.length !== 3) {
        setError("เลือกไพ่ให้ครบ 3 ใบ");
        return;
      }
      void predict({ cardNos: selected, mode: "engine", question: q });
    }
  }

  async function onAskLlm() {
    if (!result) return;
    // โหมด AI ใช้คีย์เซิร์ฟเวอร์ได้เลย — กรอกคีย์เองก็ได้ (ไม่บังคับ)
    setLlmLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/oracle-cards/predict", {
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
    <section className="oracle">
      <header className="oracle__intro">
        <h1 className="oracle__title">🔮 ไพ่ออราเคิลเคี้ยงคุง</h1>
        <p className="oracle__lead">
          จั่วแบบสุ่ม หรือเลือกเอง 3 ใบ ระบบทำนายตามหลักน้ำหนัก ไพ่หลัก 50% • ขยายชุด 1 อีก 30% •
          ขยายชุด 1 และ 2 อีก 20% — ตอบด้วย engine ก่อน แล้วกดเกลาคำด้วย LLM ได้
        </p>
      </header>

      {/* คำถาม */}
      <label className="oracle__field oracle__question-field">
        <span>คำถามที่อยากรู้ (ไม่บังคับ — ใส่เพื่อให้คำทำนายวิเคราะห์ตรงคำถาม)</span>
        <textarea
          className="oracle__input oracle__question"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="เช่น ปีนี้การงานจะเป็นอย่างไร / ควรย้ายงานไหม"
        />
      </label>

      {/* เลือกโหมด */}
      <div className="oracle__tabs">
        <button
          type="button"
          className={`oracle__tab${mode === "random" ? " oracle__tab--active" : ""}`}
          onClick={() => setMode("random")}
        >
          🎲 สุ่มไพ่
        </button>
        <button
          type="button"
          className={`oracle__tab${mode === "manual" ? " oracle__tab--active" : ""}`}
          onClick={() => setMode("manual")}
        >
          ✋ เลือกเอง 3 ใบ
        </button>
      </div>

      {mode === "manual" && (
        <div className="oracle__picker">
          <p className="oracle__pickhint">
            จิตจดจ่อกับคำถาม แล้วเลือกไพ่ตามเลข 3 ใบ (ไม่เห็นชื่อ) — เลือกแล้ว{" "}
            {selected.length}/3 {selected.length === 3 ? "✓" : ""}
          </p>
          <div className="oracle__grid">
            {shuffled.map((c) => {
              const active = selected.includes(c.no);
              const order = selected.indexOf(c.no);
              return (
                <button
                  key={c.no}
                  type="button"
                  className={`oracle__chip oracle__chip--blind${active ? " oracle__chip--active" : ""}`}
                  onClick={() => toggleSelect(c.no)}
                  aria-label={`ไพ่ใบที่ ${c.no}`}
                >
                  <span className="oracle__chip-no">#{c.no}</span>
                  {active && <span className="oracle__chip-order">เลือก {order + 1}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="oracle__actions">
        <button type="button" className="oracle__draw" onClick={onDraw} disabled={loading}>
          {loading ? "กำลังทำนาย…" : mode === "random" ? "🎲 จั่ว 3 ใบ" : "🔮 ทำนายไพ่ที่เลือก"}
        </button>
      </div>

      {error && <p className="oracle__error">⚠️ {error}</p>}

      {result && (
        <div className="oracle__result">
          <div className="oracle__cards">
            {result.cards.map((card, i) => {
              const slot = result.slots[i];
              const url = card.imageUrl ?? null;
              return (
                <article key={card.no} className="oracle__card">
                  <div className="oracle__card-media">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={card.name} className="oracle__card-img" />
                    ) : (
                      <div className="oracle__card-placeholder">ยังไม่มีรูป</div>
                    )}
                    <span className="oracle__card-weight">{slot?.weight}%</span>
                  </div>
                  <h3 className="oracle__card-name">
                    #{card.no} {card.name}
                  </h3>
                  <p className="oracle__card-kw">{card.keyword}</p>
                  <p className="oracle__card-role">{slot?.role}</p>
                </article>
              );
            })}
          </div>

          <div className="oracle__answer">
            <h2 className="oracle__answer-head">คำทำนาย (engine)</h2>
            <div className="oracle__prose">{result.engineProse}</div>
          </div>

          <div className="oracle__llm">
            <label className="oracle__field">
              <span>API key (Gemini) — ไม่บังคับ (มีคีย์เซิร์ฟเวอร์ให้แล้ว ใส่เองเพื่อไม่จำกัดโควตา)</span>
              <input
                type="password"
                className="oracle__input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="วาง API key ที่นี่"
              />
            </label>
            <button
              type="button"
              className="oracle__llm-btn"
              onClick={onAskLlm}
              disabled={llmLoading}
            >
              {llmLoading ? "กำลังเกลาคำ…" : "✨ ตอบแบบ LLM (เกลาคำ)"}
            </button>
            {llmText && (
              <div className="oracle__answer">
                <h2 className="oracle__answer-head">คำทำนาย (เกลาด้วย LLM)</h2>
                <div className="oracle__prose">{llmText}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {imageStatus && (
        <p className="oracle__admin-status">
          รูปไพ่: มีแล้ว {imageStatus.done.length}/{imageStatus.total} ใบ
        </p>
      )}
    </section>
  );
}
