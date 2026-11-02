"use client";
// ไพ่เทพเซียน (ซินแสนุ้ย 2026-11-02): เซียมซี 8 เซียน = เปิดใบเดียวตามไฟล์ · ไพ่ออราเคิล = 3 ใบ 50/30/20 เลือกชุดได้
import { useEffect, useState, type CSSProperties } from "react";

import type { ImmortalCard } from "@/lib/bazi/immortal-cards/decks";

type DeckInfo = { key: string; name: string; count: number; hasContent: boolean };
const ROLES = ["ไพ่หลัก 50%", "ขยายความ 30%", "สรุป 20%"];
const CAT_COLOR: Record<string, string> = { ดี: "#C9A24A", กลาง: "#5E8C7A", เตือน: "#8E3B36" };
const ROWS: [keyof ImmortalCard, string][] = [
  ["overall", "ภาพรวม"], ["work", "การงาน"], ["money", "การเงิน"], ["health", "สุขภาพ"], ["mind", "จิตใจ"],
  ["family", "ครอบครัว"], ["loveCouple", "ความรัก (มีคู่)"], ["loveSingle", "ความรัก (โสด)"], ["advice", "คำแนะนำ"],
];
const btn: CSSProperties = { padding: "10px 16px", borderRadius: 10, border: "1px solid #bbb", cursor: "pointer", fontWeight: 600 };

export function ImmortalCardsWorkspace() {
  const [mode, setMode] = useState<"siamsi" | "oracle">("siamsi");
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [deck, setDeck] = useState("poysian");
  const [question, setQuestion] = useState("");
  const [cards, setCards] = useState<ImmortalCard[]>([]);
  const [reading, setReading] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/immortal-cards")
      .then((r) => r.json())
      .then((b: { decks?: DeckInfo[] }) => setDecks(b.decks ?? []))
      .catch(() => {});
  }, []);

  const draw = async () => {
    setBusy(true);
    setNote("");
    setReading(null);
    setCards([]);
    try {
      const r = await fetch("/api/immortal-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, deck, question: question || undefined }),
      });
      const j = (await r.json()) as { cards?: ImmortalCard[]; reading?: string | null; note?: string; error?: { message: string } };
      if (!r.ok) throw new Error(j.error?.message ?? "ไม่สำเร็จ");
      setCards(j.cards ?? []);
      setReading(j.reading ?? null);
      setNote(j.note ?? "");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  const switchMode = (m: "siamsi" | "oracle") => {
    setMode(m);
    setCards([]);
    setReading(null);
    setNote("");
  };

  return (
    <div data-testid="immortal-cards" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={{ ...btn, background: mode === "siamsi" ? "#f6ead2" : "#fff" }} onClick={() => switchMode("siamsi")}>เซียมซี 8 เซียน</button>
        <button type="button" style={{ ...btn, background: mode === "oracle" ? "#f6ead2" : "#fff" }} onClick={() => switchMode("oracle")}>ไพ่ออราเคิลเทพเซียน</button>
      </div>
      {mode === "oracle" ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={deck} onChange={(e) => setDeck(e.target.value)} style={btn}>
            {decks.map((d) => <option key={d.key} value={d.key}>{d.name} · {d.count} ใบ{d.hasContent ? "" : " (รอเนื้อหา)"}</option>)}
          </select>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="ตั้งคำถาม (ไม่บังคับ)" style={{ ...btn, flex: 1, minWidth: 220, fontWeight: 400 }} />
        </div>
      ) : null}
      <button type="button" onClick={() => void draw()} disabled={busy} style={{ ...btn, background: "#1455A4", color: "#fff" }}>
        {busy ? "กำลังเปิดไพ่…" : mode === "siamsi" ? "เปิดเซียมซี 1 ใบ" : "เปิดไพ่ 3 ใบ"}
      </button>
      {note ? <p role="status">{note}</p> : null}
      {reading ? <p data-testid="immortal-reading" style={{ background: "#f6ead2", padding: 14, borderRadius: 12, lineHeight: 1.7 }}>{reading}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: mode === "siamsi" ? "minmax(0,1fr)" : "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
        {cards.map((c, i) => (
          <article key={c.no} data-testid={`immortal-card-${c.no}`} style={{ border: `2px solid ${CAT_COLOR[c.category ?? ""] ?? "#ccc"}`, borderRadius: 14, padding: 12 }}>
            {mode === "oracle" ? <b>{ROLES[i]}</b> : null}
            {c.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.imageUrl} alt={c.name} style={{ width: "100%", maxWidth: 320, display: "block", margin: "8px auto", borderRadius: 10 }} />
            ) : null}
            <h3 style={{ margin: "6px 0" }}>{c.no}. {c.name}</h3>
            {c.category ? <p style={{ margin: 0, fontSize: 13 }}>หมวด{c.category} · {c.deity}{c.keywords ? ` · ${c.keywords}` : ""}</p> : null}
            {mode === "siamsi" ? ROWS.map(([k, label]) => (c[k] ? <p key={k} style={{ margin: "8px 0 0" }}><b>{label}:</b> {String(c[k])}</p> : null)) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
