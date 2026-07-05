"use client";

import { useState } from "react";

import { AiNarrateButton } from "@/components/bazi/AiNarrateButton";

type TopicKey = "career" | "finance" | "health" | "love" | "family";

type Stick = {
  no: number;
  stem: string;
  branch: string;
  pillar: string;
  nayin: string;
  personality: string;
  deity: string;
  topics: Record<TopicKey, string>;
  imageUrl?: string | null;
};

type PredictResult = {
  stick: Stick;
  question: string | null;
  topic: TopicKey | null;
};

const TOPICS: { key: TopicKey; label: string }[] = [
  { key: "career", label: "การงาน" },
  { key: "finance", label: "การเงิน" },
  { key: "health", label: "สุขภาพ" },
  { key: "love", label: "ความรัก" },
  { key: "family", label: "ครอบครัว" },
];

export function FortuneSageWorkspace() {
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState<TopicKey | "all">("all");

  const [result, setResult] = useState<PredictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  async function onDraw() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fortune-sage/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: question.trim() || undefined,
          topic: topic === "all" ? undefined : topic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "เสี่ยงทายไม่สำเร็จ");
      setResult(data as PredictResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เสี่ยงทายไม่สำเร็จ");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // หัวข้อที่จะแสดง: ถ้าเลือก "ทั้งหมด" แสดงครบ 5, ไม่งั้นแสดงเฉพาะที่เลือก
  const shownTopics = topic === "all" ? TOPICS : TOPICS.filter((t) => t.key === topic);

  return (
    <section className="sage">
      <header className="sage__intro">
        <h1 className="sage__title">🎋 เซียนเสี่ยงทาย</h1>
        <p className="sage__lead">
          ตั้งจิตให้นิ่งกับคำถามที่อยากรู้ แล้วกดเสี่ยงทาย — เซียนจะสุ่มหยิบ 1 ใน 60 หัวเซี่ยงแซ
          มาตอบตามนั้น (คำทำนายตามตำราตรง ๆ ไม่แต่งเสริม)
        </p>
      </header>

      {/* คำถาม */}
      <label className="sage__field sage__question-field">
        <span>คำถามที่อยากรู้ (ไม่บังคับ)</span>
        <textarea
          className="sage__input sage__question"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="เช่น ปีนี้การงานจะเป็นอย่างไร / ควรลงทุนไหม"
        />
      </label>

      {/* เลือกหัวข้อ */}
      <div className="sage__topics" role="group" aria-label="เลือกหัวข้อ">
        <button
          type="button"
          className={`sage__topic${topic === "all" ? " sage__topic--active" : ""}`}
          onClick={() => setTopic("all")}
        >
          ทุกหัวข้อ
        </button>
        {TOPICS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`sage__topic${topic === t.key ? " sage__topic--active" : ""}`}
            onClick={() => setTopic(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="sage__actions">
        <button type="button" className="sage__draw" onClick={onDraw} disabled={loading}>
          {loading ? "กำลังเสี่ยงทาย…" : result ? "🎋 เสี่ยงใหม่" : "🎋 เสี่ยงทาย"}
        </button>
      </div>

      {error && <p className="sage__error">⚠️ {error}</p>}

      {result && (
        <div className="sage__result">
          <article className="sage__stick">
            <div className="sage__stick-media">
              {result.stick.imageUrl ? (
                <button
                  type="button"
                  className="sage__stick-imgbtn"
                  onClick={() => setZoomed(true)}
                  aria-label="ดูรูปขนาดใหญ่"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.stick.imageUrl}
                    alt={`หัวเซี่ยงแซที่ ${result.stick.no} ${result.stick.pillar}`}
                    className="sage__stick-img"
                  />
                  <span className="sage__stick-zoomhint">🔍 คลิกเพื่อขยาย</span>
                </button>
              ) : (
                <div className="sage__stick-placeholder">ยังไม่มีรูป</div>
              )}
            </div>
            <div className="sage__stick-info">
              <div className="sage__stick-head">
                <span className="sage__stick-no">หัวที่ {result.stick.no}</span>
                <span className="sage__stick-pillar">{result.stick.pillar}</span>
                <span className="sage__stick-nayin">{result.stick.nayin}</span>
              </div>
              <p className="sage__deity">{result.stick.deity}</p>
            </div>
          </article>

          <div className="sage__answer">
            <h2 className="sage__answer-head">นิสัยและพฤติกรรม</h2>
            <div className="sage__prose">{result.stick.personality}</div>
          </div>

          {shownTopics.map((t) => (
            <div key={t.key} className="sage__answer">
              <h2 className="sage__answer-head">{t.label}</h2>
              <div className="sage__prose">{result.stick.topics[t.key]}</div>
            </div>
          ))}

          <AiNarrateButton
            feature="fortune_sage"
            domainLabel={`เซียมซีใบที่ ${result.stick.no}`}
            engineText={[
              `เซียมซีหัวที่ ${result.stick.no} เสา ${result.stick.pillar} (${result.stick.nayin})`,
              `องค์เทพประจำใบ: ${result.stick.deity}`,
              `นิสัย/แก่น: ${result.stick.personality}`,
              ...shownTopics.map((t) => `${t.label}: ${result.stick.topics[t.key]}`),
            ].join("\n")}
          />
        </div>
      )}

      {zoomed && result?.stick.imageUrl && (
        <div
          className="sage__lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="รูปหัวเซี่ยงแซขนาดใหญ่"
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.stick.imageUrl}
            alt={`หัวเซี่ยงแซที่ ${result.stick.no} ${result.stick.pillar}`}
            className="sage__lightbox-img"
          />
          <button
            type="button"
            className="sage__lightbox-close"
            onClick={() => setZoomed(false)}
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
