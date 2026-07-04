"use client";

import { useEffect, useRef, useState } from "react";

import { LOUISE_HAY_AFFIRMATIONS } from "@/lib/louise-hay/affirmations";

type ScienceMeta = { route: string; label: string; note?: string | null };
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  science?: ScienceMeta;
};
type Birth = { birthDate: string; birthTime: string; gender: "female" | "male"; province: string };

const ROUTE_ICON: Record<string, string> = {
  chart: "🔮",
  day: "📅",
  timing: "⏳",
  almanac: "🗓️",
  card: "🃏",
  divine: "🎴",
  fortune: "🎋",
  phone: "📱",
  offscope: "🎲",
};

function decodeScience(route: string | null, header: string | null): ScienceMeta | undefined {
  if (!route || route === "chat") return undefined;
  let label = "";
  let note: string | null = null;
  if (header) {
    try {
      const json = typeof atob === "function" ? atob(header) : "";
      const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { label?: string; note?: string | null };
      label = parsed.label ?? "";
      note = parsed.note ?? null;
    } catch {
      /* ignore */
    }
  }
  return { route, label, note };
}

const GREETING =
  "สวัสดีค่ะ เราคือโค้ชฮีลใจ 🌷 พื้นที่ตรงนี้ปลอดภัยสำหรับคุณเสมอ วันนี้มีอะไรในใจ อยากเล่าให้เราฟังไหมคะ";

const SUGGESTIONS = [
  "วันนี้รู้สึกไม่มีค่าเลย",
  "ฉันกลัวความเปลี่ยนแปลง",
  "ให้อภัยตัวเองยังไงดี",
  "อยากรักตัวเองให้เป็น",
];

let idSeq = 0;
const nextId = () => `m${(idSeq += 1)}`;

/** แปลง **คำ** เป็นตัวหนาจริง (เน้นคำ) — ที่เหลือปล่อยเป็น text (pre-wrap คุมขึ้นบรรทัดให้เอง) */
function renderRich(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) => {
    const m = /^\*\*([^*\n]+)\*\*$/.exec(part);
    return m ? (
      <strong key={i} className="lh-b">
        {m[1]}
      </strong>
    ) : (
      part
    );
  });
}

const ANON_KEY = "lh_anon_id";

/** id นิรนามถาวรต่อเบราว์เซอร์ (ไว้นับสถิติ "คน") — สร้างครั้งแรกแล้วเก็บใน localStorage */
function getAnonId(): string {
  if (typeof window === "undefined") return "anon";
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function LouiseHayChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nextId(), role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [birth, setBirth] = useState<Birth>({
    birthDate: "",
    birthTime: "",
    gender: "female",
    province: "กรุงเทพมหานคร",
  });
  const [showBirth, setShowBirth] = useState(false);
  const [birthLinked, setBirthLinked] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const anonIdRef = useRef<string>("anon");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    anonIdRef.current = getAnonId();
  }, []);

  const birthComplete = Boolean(birth.birthDate && birth.birthTime && birth.province.trim());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setError(null);

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsStreaming(true);

    const assistantId = nextId();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/louise-hay/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          anonId: anonIdRef.current,
          ...(birthLinked && birthComplete ? { birth } : {}),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error?.message ?? `ขออภัยค่ะ ระบบขัดข้อง (${res.status})`);
      }

      const science = decodeScience(res.headers.get("X-LH-Route"), res.headers.get("X-LH-Source"));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
        );
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, science } : m)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setError(message);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content
            ? { ...m, content: "ขออภัยค่ะ ตอนนี้เราตอบไม่ได้ ลองอีกครั้งนะคะ 💗" }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function shareAffirmation() {
    const pick = LOUISE_HAY_AFFIRMATIONS[Math.floor(Math.random() * LOUISE_HAY_AFFIRMATIONS.length)];
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "assistant",
        content: `คำยืนยันสำหรับคุณวันนี้ค่ะ ลองหายใจลึก ๆ แล้วพูดกับตัวเองเบา ๆ นะคะ\n\n💗 ${pick}`,
      },
    ]);
  }

  return (
    <section className="lh-chat">
      <div className="lh-chat__stream" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`lh-msg lh-msg--${m.role}`}>
            {m.role === "assistant" && <div className="lh-msg__avatar" aria-hidden>💗</div>}
            <div className="lh-msg__bubble">
              <div className="lh-msg__text">
                {m.content ? renderRich(m.content) : isStreaming ? <span className="lh-typing"><i /><i /><i /></span> : ""}
              </div>
              {m.science && (
                <div className={`lh-chart-tag lh-chart-tag--${m.science.route}`}>
                  {ROUTE_ICON[m.science.route] ?? "✨"} {m.science.label}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {messages.length <= 1 && (
        <div className="lh-suggest">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="lh-suggest__chip" onClick={() => sendMessage(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="lh-error">{error}</p>}

      <div className="lh-birthbar">
        <button
          type="button"
          className={`lh-birthbar__toggle${apiKey.trim() ? " is-linked" : ""}`}
          onClick={() => setShowKey((v) => !v)}
        >
          {apiKey.trim() ? "🔑 ใช้ API key ของคุณ — แก้ไข" : "🔑 API key ของคุณ (ไม่บังคับ)"}
        </button>
        {apiKey.trim() && (
          <button type="button" className="lh-birthbar__clear" onClick={() => setApiKey("")}>
            ลบคีย์
          </button>
        )}
      </div>

      {showKey && (
        <div className="lh-birth">
          <p className="lh-birth__hint">
            ใส่ Gemini API key ของคุณเอง (เก็บในเบราว์เซอร์นี้เท่านั้น ไม่บันทึกที่เซิร์ฟเวอร์) —
            ถ้าเว้นว่างจะใช้คีย์กลางของระบบ
          </p>
          <input
            type="password"
            className="lh-key__input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza… (Gemini API key)"
            autoComplete="off"
          />
        </div>
      )}

      <div className="lh-birthbar">
        <button
          type="button"
          className={`lh-birthbar__toggle${birthLinked ? " is-linked" : ""}`}
          onClick={() => setShowBirth((v) => !v)}
        >
          {birthLinked ? "🔮 ผูกดวงแล้ว — แก้ไข" : "🔮 ผูกดวงของคุณ (ไม่บังคับ)"}
        </button>
        {birthLinked && (
          <button
            type="button"
            className="lh-birthbar__clear"
            onClick={() => {
              setBirthLinked(false);
              setShowBirth(false);
            }}
          >
            ยกเลิกดวง
          </button>
        )}
      </div>

      {showBirth && (
        <div className="lh-birth">
          <p className="lh-birth__hint">ใส่วันเกิดเพื่อให้โค้ชให้กำลังใจแบบอิงดวงของคุณ (เก็บไว้ในเครื่องนี้เท่านั้น)</p>
          <div className="lh-birth__grid">
            <label>
              วันเกิด
              <input
                type="date"
                value={birth.birthDate}
                onChange={(e) => setBirth((b) => ({ ...b, birthDate: e.target.value }))}
              />
            </label>
            <label>
              เวลาเกิด
              <input
                type="time"
                value={birth.birthTime}
                onChange={(e) => setBirth((b) => ({ ...b, birthTime: e.target.value }))}
              />
            </label>
            <label>
              เพศ
              <select
                value={birth.gender}
                onChange={(e) => setBirth((b) => ({ ...b, gender: e.target.value as Birth["gender"] }))}
              >
                <option value="female">หญิง</option>
                <option value="male">ชาย</option>
              </select>
            </label>
            <label>
              จังหวัด
              <input
                type="text"
                value={birth.province}
                onChange={(e) => setBirth((b) => ({ ...b, province: e.target.value }))}
              />
            </label>
          </div>
          <button
            type="button"
            className="lh-birth__link"
            disabled={!birthComplete}
            onClick={() => {
              setBirthLinked(true);
              setShowBirth(false);
            }}
          >
            ผูกดวงนี้
          </button>
        </div>
      )}

      <form
        className="lh-composer"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
      >
        <button
          type="button"
          className="lh-composer__affirm"
          onClick={shareAffirmation}
          title="ขอคำยืนยันวันนี้"
        >
          ✨ คำยืนยันวันนี้
        </button>
        <input
          className="lh-composer__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="พิมพ์สิ่งที่อยู่ในใจ…"
          disabled={isStreaming}
          aria-label="ข้อความ"
        />
        <button
          type="submit"
          className="lh-composer__send"
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? "…" : "ส่ง"}
        </button>
      </form>
    </section>
  );
}
