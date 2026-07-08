"use client";

/**
 * แคมเปญ "What If" — ประสบการณ์ 4 เฟสในหน้าเดียว (mobile-first):
 *   1) The Portal        — ฟอร์มปีเกิด + อาชีพ + consent
 *   2) Quantum Calc      — โหลดดิ้ง ประตูมิติหมุน + ข้อความสลับทุก 2 วิ
 *   3) The Revelation    — อาชีพที่ฟ้าลิขิต + ภาพ AI + นิทาน 3 บท + แชร์การ์ด
 *   4) The Reality Check — ดึงสติ + disclaimer + CTA ไปแอป Mumate
 */
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

type Stage = "portal" | "loading" | "result" | "reality";

type WhatIfResponse = {
  input: {
    birthDate: string;
    birthTime: string | null;
    gender: "male" | "female";
    yearCe: number;
    age: number;
    currentJob: string;
  };
  engineMode: "full-chart" | "year-only";
  fourPillars: { position: string; stem: string; branch: string }[] | null;
  bookCareers: string[];
  destiny: {
    ganzhiLabel: string;
    element: string;
    polarity: string;
    animal: string;
    destinedCareer: string;
    careerReason: string;
  };
  story: { shift: string; peak: string; future: string };
  model: string;
  imageUrl: string | null;
};

/** ปลายทาง CTA "ดูดวงและวางแผนชีวิตจริง" — เปลี่ยนเป็นลิงก์ LINE OA / สโตร์ได้ที่เดียว */
const MUMATE_APP_URL = "https://mumate.co";

/** ลิงก์ชวนเล่นที่ใช้ในการแชร์ + QR บนการ์ด — โดเมน production คงที่
 *  (ไม่ใช้ window.location.origin เพราะตอนเทสต์บน localhost ลิงก์/QR จะใช้กับคนอื่นไม่ได้) */
const SHARE_URL = "https://bazi-sft-dataset.vercel.app/what-if";

const LOADING_MESSAGES = [
  "กำลังสแกนเส้นทางชีวิต...",
  "ค้นหาอาชีพที่ซ่อนอยู่ในดวงชะตาของคุณ...",
  "กำลังเชื่อมต่อกับจักรวาลคู่ขนาน...",
  "สร้างภาพตัวตนของคุณในอีกมิติ...",
];

const JOB_SUGGESTIONS = [
  "พนักงานบัญชี", "วิศวกร", "ครู/อาจารย์", "พยาบาล", "ฟรีแลนซ์",
  "นักการตลาด", "โปรแกรมเมอร์", "ข้าราชการ", "พนักงานขาย",
  "เจ้าของธุรกิจ", "กราฟิกดีไซเนอร์", "พนักงานธนาคาร",
];

const ELEMENT_EMOJI: Record<string, string> = {
  ไม้: "🌳", ไฟ: "🔥", ดิน: "⛰️", ทอง: "✨", น้ำ: "🌊",
};

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** โหลดขั้นต่ำ 4.5 วิ ให้แอนิเมชันประตูมิติได้ทำงาน (API เร็วกว่านั้นก็รอ) */
const MIN_LOADING_MS = 4500;

/** นิทาน 3 บท → การ์ดสไลด์ (โทนสี/อีโมจิประจำบท) — ข้ามบทที่ว่าง */
function storyChapters(result: WhatIfResponse) {
  return [
    { key: "shift", no: 1, title: "จุดเปลี่ยน", emoji: "⚡", text: result.story.shift },
    { key: "peak", no: 2, title: "จุดพีค", emoji: "🏆", text: result.story.peak },
    { key: "future", no: 3, title: "อีก 10 ปีข้างหน้า", emoji: "🌅", text: result.story.future },
  ].filter((c) => c.text);
}

export function WhatIfExperience() {
  const [stage, setStage] = useState<Stage>("portal");
  const [birthDay, setBirthDay] = useState<string>("");
  const [birthMonth, setBirthMonth] = useState<string>("");
  const [birthYearBe, setBirthYearBe] = useState<string>("");
  const [birthTime, setBirthTime] = useState<string>("12:00");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [currentJob, setCurrentJob] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  // การ์ดแชร์พรีวิว — เจนทันทีที่ผลลัพธ์ออก ให้ผู้ใช้ "เห็นรูป" ก่อนแชร์/เซฟ
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const cardBlobRef = useRef<Blob | null>(null);
  // Section "กลับสู่โลกปัจจุบัน" — เล่นเอฟเฟกต์ตอนเลื่อนมาถึง
  const backRef = useRef<HTMLDivElement | null>(null);
  // การ์ดสไลด์นิทาน 3 บท
  const storyTrackRef = useRef<HTMLDivElement | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);

  function scrollToSlide(i: number) {
    const el = storyTrackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  // ปีเกิด พ.ศ. — ครอบช่วงเป้าหมาย 25-50 ปี แบบเผื่อขอบ (อายุ 15-80)
  const yearOptions = useMemo(() => {
    const nowBe = new Date().getFullYear() + 543;
    const years: number[] = [];
    for (let y = nowBe - 15; y >= nowBe - 80; y--) years.push(y);
    return years;
  }, []);

  // สลับข้อความโหลดทุก 2 วิ
  useEffect(() => {
    if (stage !== "loading") return;
    const t = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length), 2000);
    return () => clearInterval(t);
  }, [stage]);

  // เข้าเฟสผลลัพธ์/โลกจริงแล้วเลื่อนกลับบนสุด
  useEffect(() => {
    if (stage === "result" || stage === "reality") window.scrollTo({ top: 0, behavior: "auto" });
  }, [stage]);

  // เข้าหน้า "กลับสู่โลกปัจจุบัน" → เล่นแอนิเมชันประตูหุบ (หน่วง 1 เฟรมให้ transition ทำงาน)
  useEffect(() => {
    if (stage !== "reality") return;
    const el = backRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => el.classList.add("whatif__back--in"));
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  // ได้ผลลัพธ์แล้ว → วาดการ์ดแชร์ทันทีเป็นพรีวิวในหน้า (ไม่ต้องรอกดปุ่ม)
  useEffect(() => {
    if (!result) {
      cardBlobRef.current = null;
      setCardUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    let cancelled = false;
    void buildShareCard(result)
      .then((blob) => {
        if (cancelled) return;
        cardBlobRef.current = blob;
        setCardUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      })
      .catch(() => undefined); // วาดไม่ได้ → ปุ่มแชร์จะวาดใหม่ตอนกดเอง
    return () => {
      cancelled = true;
    };
  }, [result]);

  // วันเกิด ค.ศ. "YYYY-MM-DD" จาก dropdown พ.ศ. — null ถ้ายังกรอกไม่ครบ/วันที่ไม่จริง (เช่น 31 ก.พ.)
  const birthDateCe = useMemo(() => {
    if (!birthDay || !birthMonth || !birthYearBe) return null;
    const y = Number(birthYearBe) - 543;
    const m = Number(birthMonth);
    const d = Number(birthDay);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }, [birthDay, birthMonth, birthYearBe]);

  const formReady =
    Boolean(birthDateCe) && Boolean(gender) && currentJob.trim().length >= 2 && consent;

  async function onOpenPortal() {
    if (!formReady || !birthDateCe || !gender) return;
    setError(null);
    setStage("loading");
    setLoadingMsgIdx(0);
    const startedAt = Date.now();
    try {
      const res = await fetch("/api/what-if/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          birthDate: birthDateCe,
          ...(timeUnknown || !birthTime ? {} : { birthTime }),
          gender,
          currentJob: currentJob.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "เชื่อมต่อจักรวาลคู่ขนานไม่สำเร็จ");
      const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - startedAt));
      await new Promise((r) => setTimeout(r, wait));
      setResult(data as WhatIfResponse);
      setStage("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เชื่อมต่อจักรวาลคู่ขนานไม่สำเร็จ");
      setStage("portal");
    }
  }

  function onRestart() {
    setResult(null);
    setShareNote(null);
    setStage("portal");
    window.scrollTo({ top: 0 });
  }

  /** ลิงก์ + ข้อความชวนเล่น (ใช้ทุกแพลตฟอร์ม) */
  function shareBits() {
    const url = SHARE_URL;
    const text = result
      ? `ในจักรวาลคู่ขนาน ฉันคือ ${result.destiny.destinedCareer} ✨ ลองเปิดโลกคู่ขนานของคุณ`
      : "เปิดโลกคู่ขนานของคุณกับ Mumate ✨";
    return { url, text };
  }

  /** การ์ด (ใช้ตัวที่พรีวิวไว้แล้วถ้ามี — ไม่วาดซ้ำ) */
  async function getCardBlob(): Promise<Blob | null> {
    if (cardBlobRef.current) return cardBlobRef.current;
    if (!result) return null;
    try {
      const blob = await buildShareCard(result);
      cardBlobRef.current = blob;
      return blob;
    } catch {
      return null;
    }
  }

  /** บันทึกการ์ดลงเครื่อง — คืน true ถ้าสำเร็จ */
  async function saveCard(): Promise<boolean> {
    const blob = await getCardBlob();
    if (!blob) {
      setShareNote("สร้างการ์ดแชร์ไม่สำเร็จ ลองอีกครั้ง");
      return false;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mumate-what-if.png";
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  /** ปุ่มหลัก: มือถือ → share sheet ของเครื่อง (แนบรูปการ์ด เลือก FB/IG/LINE ได้เลย)
   *  เดสก์ท็อป → บันทึกรูป + โชว์ปุ่มรายแพลตฟอร์มด้านล่างอยู่แล้ว */
  async function onShare() {
    if (!result || sharing) return;
    setSharing(true);
    setShareNote(null);
    try {
      const blob = await getCardBlob();
      if (!blob) throw new Error("card failed");
      const file = new File([blob], "mumate-what-if.png", { type: "image/png" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        const { url, text } = shareBits();
        await navigator.share({ files: [file], title: "What If...? — โลกคู่ขนานของฉัน", text: `${text} ${url}` });
      } else {
        const ok = await saveCard();
        if (ok)
          setShareNote(
            "💾 บันทึกการ์ดลงเครื่องแล้ว (โฟลเดอร์ Downloads: mumate-what-if.png) — เลือกช่องทางด้านล่างเพื่อแชร์ลิงก์ต่อได้เลย",
          );
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setShareNote("สร้างการ์ดแชร์ไม่สำเร็จ ลองอีกครั้ง");
      }
    } finally {
      setSharing(false);
    }
  }

  async function onCopyLink() {
    const { url, text } = shareBits();
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareNote("คัดลอกข้อความ+ลิงก์แล้ว — วางในแชทไหนก็ได้");
    } catch {
      setShareNote(url);
    }
  }

  return (
    <div className="whatif">
      <div className="whatif__stars" aria-hidden />

      {stage === "portal" && (
        <section className="whatif__portal">
          <div className="whatif__brand">Mumate</div>
          <header className="whatif__hero">
            <h1 className="whatif__title">
              WHAT <span className="whatif__title-if">IF</span>...?
            </h1>
            <p className="whatif__tagline">ONE QUESTION CHANGES EVERYTHING</p>
            <p className="whatif__sub">
              ถ้าวันนั้นคุณเลือกเดินตามดวงชะตา...
              <br />
              วันนี้ชีวิตคุณจะเป็นอย่างไรในจักรวาลคู่ขนาน?
            </p>
          </header>

          <div className="whatif__form">
            <div className="whatif__field">
              <span className="whatif__label">วัน/เดือน/ปีเกิดของคุณ (พ.ศ.)</span>
              <div className="whatif__row whatif__row--dob">
                <select
                  className="whatif__input"
                  aria-label="วันเกิด"
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                >
                  <option value="">วันที่</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  className="whatif__input"
                  aria-label="เดือนเกิด"
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                >
                  <option value="">เดือน</option>
                  {THAI_MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select
                  className="whatif__input"
                  aria-label="ปีเกิด พ.ศ."
                  value={birthYearBe}
                  onChange={(e) => setBirthYearBe(e.target.value)}
                >
                  <option value="">ปี พ.ศ.</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              {birthDay && birthMonth && birthYearBe && !birthDateCe && (
                <span className="whatif__hint whatif__hint--warn">
                  วันที่นี้ไม่มีจริงในเดือนที่เลือก ลองตรวจอีกครั้ง
                </span>
              )}
            </div>

            <div className="whatif__field">
              <span className="whatif__label">เวลาเกิด (ยิ่งรู้ ยิ่งแม่น)</span>
              <div className="whatif__row whatif__row--time">
                <input
                  type="time"
                  className="whatif__input"
                  aria-label="เวลาเกิด"
                  value={birthTime}
                  disabled={timeUnknown}
                  onChange={(e) => setBirthTime(e.target.value)}
                />
                <label className="whatif__time-unknown">
                  <input
                    type="checkbox"
                    checked={timeUnknown}
                    onChange={(e) => setTimeUnknown(e.target.checked)}
                  />
                  <span>ไม่ทราบเวลา</span>
                </label>
              </div>
            </div>

            <div className="whatif__field">
              <span className="whatif__label">เพศ</span>
              <div className="whatif__row whatif__row--gender">
                <button
                  type="button"
                  className={`whatif__gender-btn${gender === "male" ? " whatif__gender-btn--active" : ""}`}
                  onClick={() => setGender("male")}
                >
                  👨 ชาย
                </button>
                <button
                  type="button"
                  className={`whatif__gender-btn${gender === "female" ? " whatif__gender-btn--active" : ""}`}
                  onClick={() => setGender("female")}
                >
                  👩 หญิง
                </button>
              </div>
            </div>

            <label className="whatif__field">
              <span className="whatif__label">อาชีพปัจจุบันของคุณ</span>
              <input
                className="whatif__input"
                list="whatif-jobs"
                placeholder="เช่น พนักงานบัญชี, วิศวกร, ฟรีแลนซ์"
                maxLength={80}
                value={currentJob}
                onChange={(e) => setCurrentJob(e.target.value)}
              />
              <datalist id="whatif-jobs">
                {JOB_SUGGESTIONS.map((j) => (
                  <option key={j} value={j} />
                ))}
              </datalist>
            </label>

            <label className="whatif__consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                ข้าพเจ้าเข้าใจว่านี่คือเรื่องราวจำลองในจักรวาลคู่ขนาน
                เพื่อความบันเทิงเท่านั้น
              </span>
            </label>

            {error && <p className="whatif__error">⚠️ {error}</p>}

            <button
              className="whatif__cta"
              disabled={!formReady}
              onClick={onOpenPortal}
            >
              🌀 เปิดประตูสู่โลกคู่ขนาน
            </button>
          </div>
        </section>
      )}

      {stage === "loading" && (
        <section className="whatif__loading" aria-live="polite">
          <div className="whatif__gate">
            <div className="whatif__gate-ring whatif__gate-ring--outer" />
            <div className="whatif__gate-ring whatif__gate-ring--inner" />
            <div className="whatif__gate-core">🔮</div>
          </div>
          <p key={loadingMsgIdx} className="whatif__loading-text">
            {LOADING_MESSAGES[loadingMsgIdx]}
          </p>
        </section>
      )}

      {stage === "result" && result && (
        <section className="whatif__result">
          {/* Section 1: The Truth */}
          <div className="whatif__truth">
            <span className="whatif__chart-badge">🔮 {result.destiny.ganzhiLabel}</span>
            <p className="whatif__truth-lead">
              ในโลกใบนี้ อาชีพของคุณคือ <strong>{result.input.currentJob}</strong>...
            </p>
            <p className="whatif__truth-reveal">แต่อาชีพที่ฟ้าลิขิตมาให้คุณคือ</p>
            <h2 className="whatif__destined">{result.destiny.destinedCareer}</h2>
            <p className="whatif__reason">
              {ELEMENT_EMOJI[result.destiny.element] ?? "✨"} {result.destiny.careerReason}
            </p>
          </div>

          {/* Section 2: The Alternate Reality */}
          <div className="whatif__reality">
            <div className="whatif__frame">
              {result.imageUrl ? (
                // data URL จาก API (สร้างสดครั้งเดียว ไม่ได้เก็บไฟล์) — ใช้ next/image ไม่ได้
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="whatif__image"
                  src={result.imageUrl}
                  alt={`คุณในโลกคู่ขนาน — ${result.destiny.destinedCareer}`}
                />
              ) : (
                <div className="whatif__avatar-fallback">
                  <span className="whatif__avatar-emoji">
                    {ELEMENT_EMOJI[result.destiny.element] ?? "✨"}
                  </span>
                  <span>ตัวคุณในอีกมิติ</span>
                </div>
              )}
            </div>

            {/* นิทาน 3 บท — การ์ดสไลด์ปัดอ่านทีละบท (โทนสีประจำบท) */}
            <div className="whatif__story">
              <div
                className="whatif__story-track"
                ref={storyTrackRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setSlideIdx(Math.round(el.scrollLeft / el.clientWidth));
                }}
              >
                {storyChapters(result).map((c) => (
                  <article key={c.key} className={`whatif__slide whatif__slide--${c.key}`}>
                    <span className="whatif__slide-emoji" aria-hidden>{c.emoji}</span>
                    <span className="whatif__slide-kicker">บทที่ {c.no}</span>
                    <h3 className="whatif__slide-title">{c.title}</h3>
                    <p className="whatif__slide-text">{c.text}</p>
                  </article>
                ))}
              </div>
              <div className="whatif__story-nav">
                <button
                  className="whatif__story-arrow"
                  aria-label="บทก่อนหน้า"
                  disabled={slideIdx === 0}
                  onClick={() => scrollToSlide(slideIdx - 1)}
                >
                  ←
                </button>
                <div className="whatif__story-dots">
                  {storyChapters(result).map((c, i) => (
                    <button
                      key={c.key}
                      className={`whatif__story-dot${i === slideIdx ? " whatif__story-dot--on" : ""}`}
                      aria-label={`ไปบทที่ ${c.no}`}
                      onClick={() => scrollToSlide(i)}
                    />
                  ))}
                </div>
                <button
                  className="whatif__story-arrow"
                  aria-label="บทถัดไป"
                  disabled={slideIdx >= storyChapters(result).length - 1}
                  onClick={() => scrollToSlide(slideIdx + 1)}
                >
                  →
                </button>
              </div>
              {slideIdx === 0 && storyChapters(result).length > 1 && (
                <p className="whatif__story-hint">ปัดเพื่ออ่านบทถัดไป →</p>
              )}
            </div>

            {result.bookCareers.length > 0 && (
              <div className="whatif__book">
                <h3 className="whatif__book-title">
                  📜 ธุรกิจ/อาชีพธาตุ{result.destiny.element}ที่ถูกโฉลกตามตำรา
                </h3>
                <div className="whatif__chips">
                  {result.bookCareers.map((c) => (
                    <span key={c} className="whatif__chip">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3: Social Sharing */}
            <div className="whatif__share">
              {cardUrl && (
                <div className="whatif__card-preview">
                  <p className="whatif__card-caption">🎴 การ์ดโลกคู่ขนานของคุณ — พร้อมแชร์</p>
                  {/* object URL ของ canvas ที่วาดสด — ใช้ next/image ไม่ได้ */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cardUrl} alt="การ์ดแชร์โลกคู่ขนาน" className="whatif__card-img" />
                  <button
                    className="whatif__card-save"
                    disabled={sharing}
                    onClick={async () => {
                      setShareNote(null);
                      const ok = await saveCard();
                      if (ok)
                        setShareNote("💾 บันทึกแล้วที่โฟลเดอร์ Downloads: mumate-what-if.png");
                    }}
                  >
                    💾 บันทึกรูปการ์ด
                  </button>
                </div>
              )}

              <button className="whatif__cta whatif__cta--share" disabled={sharing} onClick={onShare}>
                {sharing ? "กำลังสร้างการ์ด..." : "🪐 แชร์โลกคู่ขนานของคุณ"}
              </button>

              <button className="whatif__share-btn whatif__share-btn--copy" onClick={onCopyLink}>
                🔗 คัดลอกลิงก์ชวนเพื่อนมาเล่น
              </button>

              {shareNote && <p className="whatif__share-note">{shareNote}</p>}
            </div>
          </div>

          {/* ทางออกจากโลกคู่ขนาน → Page 4 (หน้าแยก) */}
          <button className="whatif__cta whatif__cta--exit" onClick={() => setStage("reality")}>
            🌏 เดินทางกลับสู่โลกปัจจุบัน
          </button>
        </section>
      )}

      {/* ── Page 4: The Reality Check (หน้าแยก) ── */}
      {stage === "reality" && result && (
        <section className="whatif__result">
          <div className="whatif__back" ref={backRef}>
            <div className="whatif__warp" aria-hidden>
              <span className="whatif__warp-ring" />
              <span className="whatif__warp-core">🌏</span>
              <span className="whatif__warp-spark whatif__warp-spark--1" />
              <span className="whatif__warp-spark whatif__warp-spark--2" />
              <span className="whatif__warp-spark whatif__warp-spark--3" />
            </div>
            <div className="whatif__divider" aria-hidden>
              <span>· · · กลับสู่โลกปัจจุบัน · · ·</span>
            </div>
            <p className="whatif__back-copy">
              คุณอาจย้อนเวลากลับไปจักรวาลคู่ขนานไม่ได้...
              แต่คุณสามารถกำหนด <strong>&ldquo;จังหวะชีวิต&rdquo;</strong>{" "}
              ในโลกความเป็นจริงให้ดีที่สุดได้ตั้งแต่วินาทีนี้
            </p>
            <div className="whatif__disclaimer">
              ⚠️ คำเตือน: เรื่องราวข้างต้นเป็นเพียงความเป็นไปได้หนึ่งเพื่อเป็นแรงบันดาลใจ
              โปรดอย่าตัดสินใจลาออกหรือเปลี่ยนแปลงชีวิตกะทันหัน
              การเปลี่ยนแปลงที่ยั่งยืนต้องมาจากการวางแผนที่รัดกุม
            </div>
            <a className="whatif__cta whatif__cta--final" href={MUMATE_APP_URL} target="_blank" rel="noreferrer">
              ✨ ดูดวงและวางแผนชีวิตจริงที่แอป Mumate
            </a>
            <p className="whatif__incentive">
              🎁 รับสิทธิ์ดูดวงจังหวะชีวิต <strong>ฟรี 1 ครั้ง</strong> สำหรับผู้มาจากโลกคู่ขนาน
            </p>
          </div>

          <div className="whatif__reality-nav">
            <button className="whatif__again" onClick={() => setStage("result")}>
              ← กลับไปดูโลกคู่ขนาน
            </button>
            <button className="whatif__again" onClick={onRestart}>
              ↻ ลองอีกจักรวาล
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/* ───────────────────────── Share card (Canvas API) ───────────────────────── */

/** แตกข้อความไทยเป็น "คำ" ด้วย Intl.Segmenter (ไทยไม่มีช่องว่างคั่นคำ) — fallback รายตัวอักษร */
function thaiWords(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    return [...seg.segment(text)].map((s) => s.segment);
  }
  return [...text];
}

/** ตัดบรรทัดตามขอบเขตคำ (ไม่หั่นกลางคำแบบ "ประเท-ศ") */
function wrapThai(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of thaiWords(text)) {
    if (ctx.measureText(line + word).width > maxWidth && line) {
      lines.push(line.trimEnd());
      line = word.trimStart();
    } else {
      line += word;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

/** เลือกขนาดฟอนต์ใหญ่สุดที่ทำให้ข้อความพอดีไม่เกิน maxLines (กันคำตก/ล้นการ์ด) */
function fitThaiText(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: { maxWidth: number; maxLines: number; sizes: number[]; fontTemplate: (size: number) => string },
): { lines: string[]; size: number } {
  for (const size of opts.sizes) {
    ctx.font = opts.fontTemplate(size);
    const lines = wrapThai(ctx, text, opts.maxWidth);
    if (lines.length <= opts.maxLines) return { lines, size };
  }
  const size = opts.sizes[opts.sizes.length - 1]!;
  ctx.font = opts.fontTemplate(size);
  return { lines: wrapThai(ctx, text, opts.maxWidth).slice(0, opts.maxLines), size };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** การ์ดแชร์ 1080×1080: พื้นหลังจักรวาล + ภาพ AI ในวงแหวนมิติ + อาชีพ + โลโก้ + QR */
async function buildShareCard(result: WhatIfResponse): Promise<Blob> {
  const SIZE = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");
  // รอฟอนต์ Prompt โหลดก่อน — ไม่งั้น measureText วัดด้วยฟอนต์ fallback แล้วตัดบรรทัดเพี้ยน
  try {
    await document.fonts.ready;
  } catch {
    // เบราว์เซอร์เก่าไม่มี Font Loading API — วาดต่อด้วยฟอนต์ที่มี
  }

  // พื้นหลังจักรวาล ม่วงลึก
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, "#170b38");
  bg.addColorStop(0.5, "#2b1160");
  bg.addColorStop(1, "#0b0723");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ดาว (ตำแหน่ง deterministic)
  ctx.save();
  for (let i = 0; i < 110; i++) {
    const x = (Math.abs(Math.sin(i * 12.9898)) * 43758.5453) % 1;
    const y = (Math.abs(Math.sin(i * 78.233)) * 12543.271) % 1;
    const r = 0.6 + ((i * 7) % 10) / 6;
    ctx.globalAlpha = 0.25 + ((i * 13) % 10) / 14;
    ctx.fillStyle = i % 6 === 0 ? "#ffd9a0" : "#e8ddff";
    ctx.beginPath();
    ctx.arc(x * SIZE, y * SIZE, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // หัวการ์ด
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4ecff";
  ctx.font = "800 92px Prompt, 'IBM Plex Sans Thai', sans-serif";
  ctx.fillText("WHAT IF...?", SIZE / 2, 128);
  ctx.fillStyle = "#c9b6ff";
  ctx.font = "500 30px Prompt, 'IBM Plex Sans Thai', sans-serif";
  ctx.fillText("ในจักรวาลคู่ขนาน ฉันคือ...", SIZE / 2, 186);

  // วงแหวนมิติ + ภาพ
  const cx = SIZE / 2;
  const cy = 470;
  const radius = 225;
  const ring = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  ring.addColorStop(0, "#ff9b2f");
  ring.addColorStop(0.5, "#ffd166");
  ring.addColorStop(1, "#ff6b4a");
  ctx.save();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 14;
  ctx.shadowColor = "rgba(255, 155, 47, 0.85)";
  ctx.shadowBlur = 46;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 10, 0, Math.PI * 2);
  ctx.clip();
  if (result.imageUrl) {
    const img = await loadImage(result.imageUrl);
    // cover-fit ลงวงกลม
    const d = (radius - 10) * 2;
    const scale = Math.max(d / img.width, d / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    const inner = ctx.createRadialGradient(cx, cy, 20, cx, cy, radius);
    inner.addColorStop(0, "#4a2d8f");
    inner.addColorStop(1, "#1b0f45");
    ctx.fillStyle = inner;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.font = "160px serif";
    ctx.fillText(ELEMENT_EMOJI[result.destiny.element] ?? "✨", cx, cy + 55);
  }
  ctx.restore();

  // ชื่ออาชีพที่ฟ้าลิขิต (ทองไล่เฉด) — ตัดตามคำ + ย่อฟอนต์อัตโนมัติให้พอดี 2 บรรทัด
  const gold = ctx.createLinearGradient(0, 760, 0, 900);
  gold.addColorStop(0, "#ffe9b8");
  gold.addColorStop(1, "#ffb23e");
  ctx.fillStyle = gold;
  const fitted = fitThaiText(ctx, result.destiny.destinedCareer, {
    maxWidth: 920,
    maxLines: 2,
    sizes: [52, 46, 40, 34],
    fontTemplate: (s) => `700 ${s}px Prompt, 'IBM Plex Sans Thai', sans-serif`,
  });
  const lineGap = fitted.size + 16;
  // จัดกึ่งกลางแนวตั้งรอบ y=812 ไม่ว่าจะ 1 หรือ 2 บรรทัด
  const firstY = 812 - ((fitted.lines.length - 1) * lineGap) / 2;
  fitted.lines.forEach((line, i) => ctx.fillText(line, SIZE / 2, firstY + i * lineGap));

  // แถบล่าง: โลโก้ + ชวนสแกน + QR
  ctx.textAlign = "left";
  ctx.fillStyle = "#f4ecff";
  ctx.font = "700 44px Prompt, sans-serif";
  ctx.fillText("Mumate", 72, SIZE - 84);
  ctx.fillStyle = "#b9a6ea";
  ctx.font = "400 26px Prompt, 'IBM Plex Sans Thai', sans-serif";
  ctx.fillText("เปิดโลกคู่ขนานของคุณ →", 72, SIZE - 44);

  const qrDataUrl = await QRCode.toDataURL(SHARE_URL, {
    width: 168,
    margin: 1,
    color: { dark: "#170b38", light: "#ffffff" },
  });
  const qr = await loadImage(qrDataUrl);
  const qrSize = 168;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  const qx = SIZE - qrSize - 64;
  const qy = SIZE - qrSize - 56;
  ctx.beginPath();
  ctx.roundRect(qx - 10, qy - 10, qrSize + 20, qrSize + 20, 18);
  ctx.fill();
  ctx.drawImage(qr, qx, qy, qrSize, qrSize);
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}
