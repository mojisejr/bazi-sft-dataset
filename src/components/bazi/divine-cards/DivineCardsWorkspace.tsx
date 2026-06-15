"use client";

import { useEffect, useMemo, useState } from "react";

type Card = {
  no: number;
  group: string;
  name: string;
  keywordEn: string;
  keywords: string;
  lifeImage: string;
  prophecy: string;
  imageBase64?: string | null;
  mime?: string | null;
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

function dataUrl(card: Card): string | null {
  if (!card.imageBase64) return null;
  return `data:${card.mime || "image/png"};base64,${card.imageBase64}`;
}

export function DivineCardsWorkspace() {
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
  const [genLoading, setGenLoading] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);

  // โหลดรายชื่อไพ่ทั้งหมด (โหมดเลือกเอง) + สถานะรูป
  useEffect(() => {
    let active = true;
    void fetch("/api/divine-cards/predict")
      .then((r) => r.json())
      .then((body) => {
        if (active && Array.isArray(body.cards)) setAllCards(body.cards);
      })
      .catch(() => {});
    void fetch("/api/divine-cards/images")
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
      const res = await fetch("/api/divine-cards/predict", {
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
    if (!apiKey.trim()) {
      setError("กรอก API key ก่อนตอบแบบ LLM");
      return;
    }
    setLlmLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/divine-cards/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cardNos: result.cards.map((c) => c.no),
          mode: "llm",
          apiKey: apiKey.trim(),
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

  async function onGenerateImages() {
    if (!apiKey.trim()) {
      setGenMsg("กรอก API key ก่อนสร้างรูป");
      return;
    }
    setGenLoading(true);
    setGenMsg("กำลังสร้างรูป (อาจใช้เวลานาน)…");
    try {
      const res = await fetch("/api/divine-cards/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "สร้างรูปไม่สำเร็จ");
      setGenMsg(
        `สำเร็จ ${data.succeeded?.length ?? 0} ใบ` +
          (data.failed?.length ? ` • ล้มเหลว ${data.failed.length} ใบ (${data.failed[0]?.error})` : ""),
      );
      // refresh สถานะ
      const status = await fetch("/api/divine-cards/images").then((r) => r.json());
      if (typeof status.total === "number") setImageStatus(status);
    } catch (e) {
      setGenMsg(e instanceof Error ? e.message : "สร้างรูปไม่สำเร็จ");
    } finally {
      setGenLoading(false);
    }
  }

  return (
    <section className="divine">
      <header className="divine__intro">
        <h1 className="divine__title">🎴 โหมดเซียน — ไพ่จิตวิญญาณแดนสวรรค์</h1>
        <p className="divine__lead">
          จั่วแบบสุ่ม หรือเลือกเอง 3 ใบ ระบบทำนายตามหลักน้ำหนัก ไพ่หลัก 50% • ขยายชุด 1 อีก 30% •
          ขยายชุด 1 และ 2 อีก 20% — ตอบด้วย engine ก่อน แล้วกดเกลาคำด้วย LLM ได้
        </p>
      </header>

      {/* คำถาม */}
      <label className="divine__field divine__question-field">
        <span>คำถามที่อยากรู้ (ไม่บังคับ — ใส่เพื่อให้คำทำนายวิเคราะห์ตรงคำถาม)</span>
        <textarea
          className="divine__input divine__question"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="เช่น ปีนี้การงานจะเป็นอย่างไร / ควรย้ายงานไหม"
        />
      </label>

      {/* เลือกโหมด */}
      <div className="divine__tabs">
        <button
          type="button"
          className={`divine__tab${mode === "random" ? " divine__tab--active" : ""}`}
          onClick={() => setMode("random")}
        >
          🎲 สุ่มไพ่
        </button>
        <button
          type="button"
          className={`divine__tab${mode === "manual" ? " divine__tab--active" : ""}`}
          onClick={() => setMode("manual")}
        >
          ✋ เลือกเอง 3 ใบ
        </button>
      </div>

      {mode === "manual" && (
        <div className="divine__picker">
          <p className="divine__pickhint">
            จิตจดจ่อกับคำถาม แล้วเลือกไพ่ตามเลข 3 ใบ (ไม่เห็นชื่อ) — เลือกแล้ว{" "}
            {selected.length}/3 {selected.length === 3 ? "✓" : ""}
          </p>
          <div className="divine__grid">
            {shuffled.map((c) => {
              const active = selected.includes(c.no);
              const order = selected.indexOf(c.no);
              return (
                <button
                  key={c.no}
                  type="button"
                  className={`divine__chip divine__chip--blind${active ? " divine__chip--active" : ""}`}
                  onClick={() => toggleSelect(c.no)}
                  aria-label={`ไพ่ใบที่ ${c.no}`}
                >
                  <span className="divine__chip-no">#{c.no}</span>
                  {active && <span className="divine__chip-order">เลือก {order + 1}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="divine__actions">
        <button type="button" className="divine__draw" onClick={onDraw} disabled={loading}>
          {loading ? "กำลังทำนาย…" : mode === "random" ? "🎲 จั่ว 3 ใบ" : "🔮 ทำนายไพ่ที่เลือก"}
        </button>
      </div>

      {error && <p className="divine__error">⚠️ {error}</p>}

      {result && (
        <div className="divine__result">
          <div className="divine__cards">
            {result.cards.map((card, i) => {
              const slot = result.slots[i];
              const url = dataUrl(card);
              return (
                <article key={card.no} className="divine__card">
                  <div className="divine__card-media">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={card.name} className="divine__card-img" />
                    ) : (
                      <div className="divine__card-placeholder">ยังไม่มีรูป</div>
                    )}
                    <span className="divine__card-weight">{slot?.weight}%</span>
                  </div>
                  <h3 className="divine__card-name">
                    #{card.no} {card.name}
                  </h3>
                  <p className="divine__card-kw">{card.keywordEn}</p>
                  <p className="divine__card-role">{slot?.role}</p>
                </article>
              );
            })}
          </div>

          <div className="divine__answer">
            <h2 className="divine__answer-head">คำทำนาย (engine)</h2>
            <div className="divine__prose">{result.engineProse}</div>
          </div>

          <div className="divine__llm">
            <label className="divine__field">
              <span>API key (Gemini) — สำหรับตอบแบบ LLM</span>
              <input
                type="password"
                className="divine__input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="วาง API key ที่นี่"
              />
            </label>
            <button
              type="button"
              className="divine__llm-btn"
              onClick={onAskLlm}
              disabled={llmLoading}
            >
              {llmLoading ? "กำลังเกลาคำ…" : "✨ ตอบแบบ LLM (เกลาคำ)"}
            </button>
            {llmText && (
              <div className="divine__answer">
                <h2 className="divine__answer-head">คำทำนาย (เกลาด้วย LLM)</h2>
                <div className="divine__prose">{llmText}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* แผงผู้ดูแล: สร้างรูปไพ่ */}
      <details className="divine__admin">
        <summary>⚙️ สร้างรูปไพ่ (ผู้ดูแล)</summary>
        <p className="divine__admin-status">
          {imageStatus
            ? `มีรูปแล้ว ${imageStatus.done.length}/${imageStatus.total} ใบ`
            : "กำลังโหลดสถานะ…"}
        </p>
        <p className="divine__admin-hint">
          ใช้ API key ด้านบน สร้างรูปเฉพาะใบที่ยังไม่มี (ใช้ Imagen — ต้องการสิทธิ์ของ key)
        </p>
        <button
          type="button"
          className="divine__llm-btn"
          onClick={onGenerateImages}
          disabled={genLoading}
        >
          {genLoading ? "กำลังสร้าง…" : "🖼️ สร้างรูปไพ่ที่ยังไม่มี"}
        </button>
        {genMsg && <p className="divine__admin-msg">{genMsg}</p>}
      </details>
    </section>
  );
}
