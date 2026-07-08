"use client";

import { useEffect, useRef, useState } from "react";

import { LOUISE_HAY_AFFIRMATIONS } from "@/lib/louise-hay/affirmations";
import { getLiffIdToken, liffAvailable } from "@/lib/louise-hay/liff-client";

type ScienceMeta = { route: string; label: string; note?: string | null };
type AlertDay = { date: string; kind: "luck" | "caution" | "custom"; label: string; message: string };
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  science?: ScienceMeta;
  alerts?: AlertDay[];
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
  mu: "🙏",
  fengshui: "🏮",
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

/** ถอด X-LH-Alerts (base64 JSON) → รายการวันที่ตั้งเตือนได้ */
function decodeAlerts(header: string | null): AlertDay[] | undefined {
  if (!header) return undefined;
  try {
    const bytes = Uint8Array.from(atob(header), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as AlertDay[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

const GREETING =
  "สวัสดีค่ะ เราคือโค้ชฮีลใจ 🌷 พื้นที่ตรงนี้ปลอดภัยสำหรับคุณเสมอ วันนี้มีอะไรในใจ อยากเล่าให้เราฟังไหมคะ";

// ป้าย (มี emoji) + ข้อความจริงที่ส่ง — โชว์ความสามารถทั้งฮีลใจ + เสี่ยงทาย ให้ผู้ใช้รู้ว่าถามอะไรได้บ้าง
const SUGGESTIONS: { label: string; prompt: string }[] = [
  { label: "💗 วันนี้รู้สึกไม่มีค่า", prompt: "วันนี้รู้สึกไม่มีค่าเลย" },
  { label: "🍽️ วันนี้กินอะไรดี", prompt: "วันนี้กินอะไรดีให้เสริมดวง" },
  { label: "🎋 ขอเซียมซี", prompt: "ขอเสี่ยงเซียมซีหน่อย" },
  { label: "🃏 จั่วไพ่แนะนำ", prompt: "ขอจั่วไพ่แนะนำหน่อย" },
  { label: "🗓️ เลือกวันมงคลเดือนนี้", prompt: "ช่วยเลือกวันมงคลในเดือนนี้ให้หน่อย" },
  { label: "📱 ดูเบอร์มือถือ", prompt: "อยากให้ดูเบอร์มือถือ" },
  { label: "🙏 ไปมูที่ไหนดี", prompt: "ช่วงนี้อยากไปไหว้พระเสริมดวง ควรไปมูที่ไหนดี" },
];

// กล่องแนะนำ "คำถามถัดไป" หลังโค้ชตอบเสร็จ — เลือกชุดตามศาสตร์ที่เพิ่งใช้ตอบ
const LIFESTYLE_FOLLOWUPS: { label: string; prompt: string }[] = [
  { label: "🍽️ วันนี้กินอะไรดี", prompt: "วันนี้กินอะไรดีให้เสริมดวง" },
  { label: "👗 ใส่เสื้อสีอะไรดี", prompt: "วันนี้ใส่เสื้อสีอะไรดี" },
  { label: "🚶 ออกบ้านทิศไหน", prompt: "วันนี้ออกจากบ้านทิศไหนดี ก้าวเท้าไหนก่อน" },
  { label: "⏰ ช่วงไหนของวันดี", prompt: "วันนี้ช่วงเวลาไหนทำอะไรดี" },
];
const CHART_FOLLOWUPS: { label: string; prompt: string }[] = [
  { label: "💼 การงานฉันเป็นไง", prompt: "ดูเรื่องการงานของฉันหน่อย" },
  { label: "💰 การเงินฉันเป็นไง", prompt: "ดูเรื่องการเงินของฉันหน่อย" },
  { label: "❤️ ความรักฉันเป็นไง", prompt: "ดูเรื่องความรักของฉันหน่อย" },
  { label: "🍽️ วันนี้กินอะไรดี", prompt: "วันนี้กินอะไรดีให้เสริมดวง" },
];
const MU_FOLLOWUPS: { label: string; prompt: string }[] = [
  { label: "🙏 องค์เทพที่ถูกโฉลก", prompt: "ดวงของเราถูกโฉลกกับองค์เทพองค์ไหน" },
  { label: "👗 สีเสื้อมงคลของฉัน", prompt: "สีเสื้อมงคลประจำดวงฉันคือสีอะไร" },
  { label: "🏮 กระเป๋าตังสีอะไรดี", prompt: "กระเป๋าสตางค์ควรใช้สีอะไรเรียกทรัพย์" },
  { label: "🗓️ เลือกวันมงคลไปมู", prompt: "ช่วยเลือกวันมงคลในเดือนนี้สำหรับไปไหว้พระหน่อย" },
];
const DEFAULT_FOLLOWUPS: { label: string; prompt: string }[] = [
  { label: "🍽️ วันนี้กินอะไรดี", prompt: "วันนี้กินอะไรดีให้เสริมดวง" },
  { label: "🌙 ช่วงนี้ควรทำอะไร", prompt: "ช่วงนี้ควรโฟกัสทำอะไรดี" },
  { label: "💗 ขอกำลังใจหน่อย", prompt: "วันนี้รู้สึกเหนื่อย ขอกำลังใจหน่อย" },
  { label: "🎋 ขอเซียมซี", prompt: "ขอเสี่ยงเซียมซีหน่อย" },
];

function followupsFor(route?: string): { label: string; prompt: string }[] {
  switch (route) {
    case "almanac":
    case "day":
    case "timing":
      return LIFESTYLE_FOLLOWUPS;
    case "chart":
      return CHART_FOLLOWUPS;
    case "mu":
    case "fengshui":
      return MU_FOLLOWUPS;
    default:
      return DEFAULT_FOLLOWUPS;
  }
}

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

const ALERT_EMOJI: Record<AlertDay["kind"], string> = { luck: "🍀", caution: "🌙", custom: "🔔" };

/** YYYY-MM-DD → YYYYMMDD และวันถัดไป (all-day event: end แบบ exclusive) */
function icsDates(date: string): { start: string; end: string } {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: date.replace(/-/g, ""),
    end: `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`,
  };
}

/** ลิงก์เปิดหน้า "เพิ่ม event" ใน Google Calendar โดยตรง (ไม่โหลดไฟล์) */
function googleCalUrl(a: AlertDay): string {
  const { start, end } = icsDates(a.date);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${ALERT_EMOJI[a.kind]} ${a.label}`,
    dates: `${start}/${end}`,
    details: a.message,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** ลิงก์ .ics ของเรา (ปฏิทินในเครื่อง: iOS/Android เปิดแอปให้เพิ่ม, desktop เปิดไฟล์เข้า Outlook/Apple) */
function icsUrl(a: AlertDay): string {
  return `/api/alerts/ics?${new URLSearchParams({ date: a.date, kind: a.kind, label: a.label, message: a.message }).toString()}`;
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
  // สถานะปุ่มตั้งเตือนต่อวัน: key = date|kind → saving/done/error
  const [alertStatus, setAlertStatus] = useState<Record<string, "saving" | "done" | "error">>({});
  const [canAlert, setCanAlert] = useState(false);
  // key ของวันที่กำลังเปิดเมนู "เพิ่มลงปฏิทิน" (Google / ในเครื่อง) — null = ปิด
  const [calMenu, setCalMenu] = useState<string | null>(null);
  const anonIdRef = useRef<string>("anon");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    anonIdRef.current = getAnonId();
    void liffAvailable().then(setCanAlert);
  }, []);

  async function setAlert(day: AlertDay) {
    const key = `${day.date}|${day.kind}`;
    if (alertStatus[key] === "saving" || alertStatus[key] === "done") return;
    setAlertStatus((s) => ({ ...s, [key]: "saving" }));
    try {
      const idToken = await getLiffIdToken();
      if (!idToken) {
        // ไม่มี token = ยังไม่ได้เปิดผ่าน LINE (หรือกำลัง redirect ไป login)
        setAlertStatus((s) => ({ ...s, [key]: "error" }));
        setError("ตั้งเตือนได้เมื่อเปิดหน้านี้ผ่านแอป LINE นะคะ 🌷");
        return;
      }
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          targetDate: day.date,
          kind: day.kind,
          message: day.message,
          ...(birthLinked && birthComplete ? { birthKey: `${birth.birthDate}|${birth.province}` } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "ตั้งเตือนไม่สำเร็จ");
      setAlertStatus((s) => ({ ...s, [key]: "done" }));
    } catch (err) {
      setAlertStatus((s) => ({ ...s, [key]: "error" }));
      setError(err instanceof Error ? err.message : "ตั้งเตือนไม่สำเร็จ");
    }
  }

  const birthComplete = Boolean(birth.birthDate && birth.birthTime && birth.province.trim());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setError(null);

    // หมวดของคำตอบโค้ชล่าสุด — ส่งไปช่วยจัดหมวดคำถามต่อเนื่อง (ไม่จั่วไพ่/เปิดศาสตร์ใหม่ทุกครั้ง)
    const prevRoute = [...messages].reverse().find((m) => m.role === "assistant" && m.science)?.science
      ?.route;

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
          ...(prevRoute ? { prevRoute } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error?.message ?? `ขออภัยค่ะ ระบบขัดข้อง (${res.status})`);
      }

      const science = decodeScience(res.headers.get("X-LH-Route"), res.headers.get("X-LH-Source"));
      const alerts = decodeAlerts(res.headers.get("X-LH-Alerts"));
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
        prev.map((m) => (m.id === assistantId ? { ...m, science, alerts } : m)),
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
              {m.alerts && m.alerts.length > 0 && (
                <div className="lh-alerts">
                  <span className="lh-alerts__hint">🔔 ตั้งเตือนผ่าน LINE{canAlert ? "" : " (เปิดผ่านแอป LINE)"} หรือ 📅 เพิ่มลงปฏิทินในเครื่อง</span>
                  <div className="lh-alerts__row">
                    {m.alerts.map((a) => {
                      const key = `${a.date}|${a.kind}`;
                      const st = alertStatus[key];
                      return (
                        <span key={key} className="lh-alert-pair">
                          <button
                            type="button"
                            className={`lh-alert-chip lh-alert-chip--${a.kind}${st === "done" ? " is-done" : ""}`}
                            disabled={st === "saving" || st === "done"}
                            onClick={() => setAlert(a)}
                          >
                            {st === "done"
                              ? `✓ ตั้งเตือนแล้ว · ${a.label}`
                              : st === "saving"
                                ? `กำลังตั้ง… ${a.label}`
                                : `🔔 ${a.label}`}
                          </button>
                          <button
                            type="button"
                            className={`lh-alert-chip lh-alert-chip--cal lh-alert-chip--${a.kind}${calMenu === key ? " is-open" : ""}`}
                            title="เพิ่มลงปฏิทิน"
                            aria-label={`เพิ่ม ${a.label} ลงปฏิทิน`}
                            aria-expanded={calMenu === key}
                            onClick={() => setCalMenu((k) => (k === key ? null : key))}
                          >
                            📅
                          </button>
                          {calMenu === key && (
                            <div className="lh-cal-menu" role="menu">
                              <a
                                className="lh-cal-menu__item"
                                href={googleCalUrl(a)}
                                target="_blank"
                                rel="noopener noreferrer"
                                role="menuitem"
                                onClick={() => setCalMenu(null)}
                              >
                                🟢 Google ปฏิทิน
                              </a>
                              <a
                                className="lh-cal-menu__item"
                                href={icsUrl(a)}
                                role="menuitem"
                                onClick={() => setCalMenu(null)}
                              >
                                📆 ปฏิทินในเครื่อง
                              </a>
                            </div>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {messages.length <= 1 && (
        <div className="lh-suggest">
          {SUGGESTIONS.map((s) => (
            <button key={s.label} type="button" className="lh-suggest__chip" onClick={() => sendMessage(s.prompt)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {(() => {
        const last = messages[messages.length - 1];
        const show =
          !isStreaming && messages.length > 1 && last?.role === "assistant" && Boolean(last.content);
        if (!show) return null;
        return (
          <div className="lh-suggest lh-suggest--followup">
            <span className="lh-suggest__hint">ถามต่อได้เลย</span>
            {followupsFor(last.science?.route).map((s) => (
              <button
                key={s.label}
                type="button"
                className="lh-suggest__chip"
                onClick={() => sendMessage(s.prompt)}
              >
                {s.label}
              </button>
            ))}
          </div>
        );
      })()}

      {error && <p className="lh-error">{error}</p>}

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
