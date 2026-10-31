"use client";
/**
 * เก้าประตู เปิดชะตา — หลังบ้าน (ซินแสนุ้ย 2026-10-29 · layer 1 ตามต้นแบบ kiang-kung-astrology)
 * เลือกสำรับ → ทอย 3 ส่วน (เลขดิถี · ตำแหน่งดิถี · ตำแหน่ง 開) → เปิดไพ่ 9 ช่องตามผังหลอซู (ไม่ซ้ำในรอบ)
 * ยังไม่มีคำทำนาย AI (layer ถัดไป) — หน้าจอนี้คือพิธีจัดผัง + เปิดไพ่ให้ซินแสอ่านเอง
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ELEMENT_BY_DIGIT,
  PALACES,
  displayedGate,
  effectiveGateStart,
  gateAssignments,
  gateRollLabel,
  palaceByNumber,
} from "@/lib/bazi/nine-gates/rules";

type Card = { no: number; name: string; imageUrl: string | null };
type DeckKey = "oracle" | "love" | "fengshui";
/** แผ่นใส (ซินแสนุ้ย 2026-10-31): แต่ละชั้นแยกงานกัน คำทำนายจะอ่านทุกชั้นรวมกัน · เนื้อหาเพิ่มทีละแผ่น */
type LayerKey = "cards" | "gates" | "dithi";
const LAYERS: { key: LayerKey; label: string }[] = [
  { key: "cards", label: "แผ่น 1 · ไพ่ออราเคิล 9 ช่อง" },
  { key: "gates", label: "แผ่น 2 · 8 ประตู" },
  { key: "dithi", label: "แผ่น 3 · ดิถี 0–9" },
];

const DECKS: { key: DeckKey; label: string; name: string; symbol: string }[] = [
  {
    key: "oracle",
    label: "คำถามทั่วไป",
    name: "ไพ่ออราเคิลเคี้ยงคุง",
    symbol: "✧",
  },
  { key: "love", label: "ความรัก", name: "ไพ่ความรัก", symbol: "♡" },
  {
    key: "fengshui",
    label: "ฮวงจุ้ย",
    name: "ไพ่อาถรรพ์ฮวงจุ้ย",
    symbol: "☷",
  },
];

const STORE_KEY = "nine-gates-round-v1";

function randomIndex(n: number): number {
  const v = new Uint32Array(1);
  crypto.getRandomValues(v);
  return v[0] % n;
}

const C = {
  bg: "#1c1014",
  panel: "#2a171d",
  line: "rgba(214,180,120,0.35)",
  gold: "#e3c27e",
  text: "#f3e6d3",
  sub: "#bfa98f",
  fire: "#c2553a",
};

function pillStyle(bg: string = C.panel): React.CSSProperties {
  return {
    border: `1px solid ${C.line}`,
    background: bg,
    color: C.text,
    borderRadius: 12,
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: 14,
  };
}

function Die({
  step,
  title,
  sub,
  value,
  label,
  onRoll,
}: {
  step: string;
  title: string;
  sub: string;
  value: number | null;
  label: string;
  onRoll: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 200,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding: 12,
        background: "#24141a",
      }}
      data-testid={`ng-die-${step}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: C.gold, fontSize: 12 }}>{step}</span>
        <div style={{ flex: 1 }}>
          <b style={{ color: C.text }}>{title}</b>
          <div style={{ color: C.sub, fontSize: 12 }}>{sub}</div>
        </div>
        <span
          style={{
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            borderRadius: 10,
            background: value === null ? "#3a2a2a" : C.gold,
            color: "#2a171d",
            fontWeight: 800,
            fontSize: 22,
          }}
        >
          {value === null ? "—" : value}
        </span>
      </div>
      <button
        type="button"
        onClick={onRoll}
        style={{ ...pillStyle("#4a2b35"), width: "100%", marginTop: 10 }}
      >
        ✦ {label}
      </button>
    </div>
  );
}

export function NineGatesWorkspace() {
  const [deckKey, setDeckKey] = useState<DeckKey>("oracle");
  const [fetched, setFetched] = useState<Card[]>([]);
  // สำรับที่โหลดเสร็จล่าสุด — loading = ยังไม่ใช่สำรับที่เลือก (ไม่ setState ตรง ๆ ใน effect)
  const [loadedDeck, setLoadedDeck] = useState<DeckKey | null>(null);
  const [slots, setSlots] = useState<(Card | null)[]>(Array(9).fill(null));
  const [digit, setDigit] = useState<number | null>(null);
  const [masterPos, setMasterPos] = useState<number | null>(null);
  const [gateRoll, setGateRoll] = useState<number | null>(null);
  const [zoom, setZoom] = useState<Card | null>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ cards: true, gates: true, dithi: true });
  const [restored, setRestored] = useState(false);

  // คืนรอบล่าสุดจากเครื่อง (เปิดหน้าใหม่ไม่หาย)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as {
        deckKey?: DeckKey;
        slots?: (Card | null)[];
        digit?: number | null;
        masterPos?: number | null;
        gateRoll?: number | null;
      } | null;
      if (s) {
        /* eslint-disable react-hooks/set-state-in-effect -- คืนรอบเดิมจาก localStorage หลัง mount ครั้งเดียว (SSR อ่าน storage ไม่ได้) */
        if (s.deckKey && DECKS.some((d) => d.key === s.deckKey))
          setDeckKey(s.deckKey);
        if (Array.isArray(s.slots) && s.slots.length === 9) setSlots(s.slots);
        setDigit(s.digit ?? null);
        setMasterPos(s.masterPos ?? null);
        setGateRoll(s.gateRoll ?? null);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      /* ไม่มีของเดิม */
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ deckKey, slots, digit, masterPos, gateRoll }),
      );
    } catch {
      /* storage ปิด */
    }
  }, [restored, deckKey, slots, digit, masterPos, gateRoll]);

  useEffect(() => {
    if (deckKey === "love") return;
    let alive = true;
    void fetch(`/api/nine-gates/deck?deck=${deckKey}`)
      .then((r) => r.json())
      .then((b: { cards?: Card[] }) => {
        if (!alive) return;
        setFetched(b.cards ?? []);
        setLoadedDeck(deckKey);
      })
      .catch(() => {
        if (!alive) return;
        setFetched([]);
        setLoadedDeck(deckKey);
      });
    return () => {
      alive = false;
    };
  }, [deckKey]);

  const cards = useMemo<Card[]>(
    () => (deckKey === "love" || loadedDeck !== deckKey ? [] : fetched),
    [deckKey, loadedDeck, fetched],
  );
  const loading = deckKey !== "love" && loadedDeck !== deckKey;
  const used = useMemo(
    () => new Set(slots.filter(Boolean).map((c) => (c as Card).no)),
    [slots],
  );
  const remaining = cards.length - used.size;
  const opened = slots.filter(Boolean).length;
  const assignments = useMemo(() => gateAssignments(gateRoll), [gateRoll]);

  const drawOne = useCallback(
    (prev: (Card | null)[], i: number): (Card | null)[] => {
      if (prev[i]) return prev;
      const taken = new Set(prev.filter(Boolean).map((c) => (c as Card).no));
      const pool = cards.filter((c) => !taken.has(c.no));
      if (pool.length === 0) return prev;
      const next = prev.slice();
      next[i] = pool[randomIndex(pool.length)];
      return next;
    },
    [cards],
  );

  const drawAll = () =>
    setSlots((prev) => {
      let s = prev;
      for (let i = 0; i < 9; i++) s = drawOne(s, i);
      return s;
    });

  const selectDeck = (k: DeckKey) => {
    if (k === deckKey) return;
    setDeckKey(k);
    setSlots(Array(9).fill(null)); // เปลี่ยนสำรับ = เริ่มเปิดไพ่ใหม่ (ผลทอยคงไว้)
  };

  const reset = () => {
    if (!window.confirm("เริ่มรอบใหม่? ล้างผลทอยทั้ง 3 ส่วนและไพ่ที่เปิด"))
      return;
    setSlots(Array(9).fill(null));
    setDigit(null);
    setMasterPos(null);
    setGateRoll(null);
  };

  const deckInfo = DECKS.find((d) => d.key === deckKey)!;
  const pill = pillStyle;

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        borderRadius: 20,
        padding: 20,
        fontFamily: "inherit",
      }}
      data-testid="nine-gates"
    >
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ color: C.gold, fontSize: 12, letterSpacing: 2 }}>
          พิธีแห่งภาพและสัญลักษณ์
        </div>
        <h1 style={{ margin: "6px 0", fontSize: 30, color: C.text }}>
          เก้าประตู เปิดชะตา
        </h1>
        <p style={{ color: C.sub, margin: 0 }}>
          ตั้งจิตให้สงบ เลือกเรื่องที่ต้องการถาม แล้วเปิดไพ่ทั้ง ๙ ประตู
          เพื่ออ่านเรื่องราวและแนวทางจากภาพและสัญลักษณ์
        </p>
      </div>

      {/* 01 เลือกสำรับ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {DECKS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => selectDeck(d.key)}
            aria-pressed={d.key === deckKey}
            data-testid={`ng-deck-${d.key}`}
            style={{
              ...pill(d.key === deckKey ? "#4a2b35" : C.panel),
              textAlign: "left",
              borderColor: d.key === deckKey ? C.gold : C.line,
            }}
          >
            <span style={{ color: C.gold, marginRight: 8 }}>{d.symbol}</span>
            <b>{d.label}</b>
            <div style={{ color: C.sub, fontSize: 12 }}>{d.name}</div>
          </button>
        ))}
      </div>
      <p style={{ color: C.sub, fontSize: 13, margin: "0 0 14px" }}>
        {deckInfo.name} ·{" "}
        {deckKey === "love"
          ? "ยังไม่มีไพ่ชุดนี้ในระบบ (รอไฟล์ภาพ)"
          : loading
            ? "กำลังโหลดสำรับ…"
            : `${cards.length} ใบ`}
      </p>

      {/* 02 ทอย 3 ส่วน */}
      <div
        style={{
          border: `1px solid ${C.line}`,
          borderRadius: 16,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ color: C.gold, marginBottom: 10 }}>
          กำหนดผังดิถีและ 8 ประตู · ทอยตำแหน่งตามผังหลอซู
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Die
            step="01"
            title="เลขดิถี"
            sub="กำหนดธาตุของดิถี"
            value={digit}
            label={digit === null ? "ทอยเลขดิถี" : "ทอยเลขใหม่"}
            onRoll={() => setDigit(randomIndex(10))}
          />
          <Die
            step="02"
            title="ตำแหน่งดิถี"
            sub="เลือกวังเลข 1–9 ตามผังหลอซู"
            value={masterPos}
            label={masterPos === null ? "ทอยตำแหน่งดิถี" : "ทอยตำแหน่งใหม่"}
            onRoll={() => setMasterPos(randomIndex(9) + 1)}
          />
          <Die
            step="03"
            title="ตำแหน่ง 開 ไค"
            sub="ทอยหาวังเริ่มต้นของ 8 ประตู"
            value={gateRoll}
            label={gateRoll === null ? "ทอยตำแหน่ง 開" : "ทอยตำแหน่งใหม่"}
            onRoll={() => setGateRoll(randomIndex(10))}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            marginTop: 12,
            fontSize: 14,
          }}
          data-testid="ng-result"
        >
          {digit === null && masterPos === null && gateRoll === null ? (
            <span style={{ color: C.sub }}>
              ทอยลูกเต๋าทั้ง 3 ส่วนเพื่อจัดผังให้สมบูรณ์
            </span>
          ) : null}
          {digit !== null ? (
            <span>
              เลขดิถี <b>{digit}</b> · {ELEMENT_BY_DIGIT[digit]}
            </span>
          ) : null}
          {masterPos !== null ? (
            <span>
              ดิถีสถิต <b>วังเลข {masterPos}</b> ·{" "}
              {palaceByNumber(masterPos)?.direction}
            </span>
          ) : null}
          {gateRoll !== null ? (
            <span>
              開 ไค เริ่ม <b>{gateRollLabel(gateRoll)}</b> ·{" "}
              {palaceByNumber(effectiveGateStart(gateRoll))?.direction}
            </span>
          ) : null}
        </div>
      </div>

      {/* 03 เปิดไพ่ */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={drawAll}
          disabled={opened === 9 || remaining <= 0}
          style={{
            ...pill("#5a3340"),
            opacity: opened === 9 || remaining <= 0 ? 0.5 : 1,
          }}
          data-testid="ng-draw-all"
        >
          ⤮{" "}
          {opened === 9
            ? "เปิดครบ 9 ช่องแล้ว"
            : opened === 0
              ? "สุ่มครบ 9 ช่อง"
              : "สุ่มช่องที่เหลือ"}
        </button>
        <button type="button" onClick={reset} style={pill()}>
          ↺ เริ่มใหม่
        </button>
        <span style={{ marginLeft: "auto", color: C.sub, fontSize: 13 }}>
          เปิดแล้ว {opened} / 9 ใบ ·{" "}
          {cards.length
            ? `เหลือในสำรับ ${Math.max(0, remaining)} ใบ`
            : "ยังไม่มีไพ่ในชุดนี้"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }} data-testid="ng-layers">
        {LAYERS.map((l) => (
          <label key={l.key} style={{ color: C.text, fontSize: 13 }}>
            <input type="checkbox" checked={layers[l.key]} onChange={(e) => setLayers((v) => ({ ...v, [l.key]: e.target.checked }))} /> {l.label}
          </label>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,minmax(0,1fr))",
          gap: 12,
        }}
        data-testid="ng-board"
      >
        {PALACES.map((p, i) => {
          const card = layers.cards ? slots[i] : null;
          const gate = layers.gates ? displayedGate(assignments, p.number, masterPos) : undefined;
          const isMaster = layers.dithi && masterPos === p.number;
          return (
            <button
              key={p.number}
              type="button"
              data-testid={`ng-slot-${p.number}`}
              onClick={() =>
                card ? setZoom(card) : setSlots((prev) => drawOne(prev, i))
              }
              disabled={!card && cards.length === 0}
              style={{
                position: "relative",
                aspectRatio: "2 / 3",
                borderRadius: 14,
                overflow: "hidden",
                cursor: "pointer",
                padding: 0,
                border: `2px solid ${isMaster ? C.fire : C.line}`,
                background: card
                  ? "#000"
                  : "linear-gradient(160deg,#3b2129,#1f1115)",
              }}
            >
              {card ? (
                card.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      height: "100%",
                      color: C.text,
                      padding: 8,
                    }}
                  >
                    #{card.no} {card.name}
                  </span>
                )
              ) : (
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    height: "100%",
                    color: C.sub,
                    fontSize: 13,
                  }}
                >
                  แตะเพื่อเปิดไพ่
                </span>
              )}
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  right: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(28,16,20,0.85)",
                  borderRadius: 999,
                  padding: "3px 8px",
                  fontSize: 12,
                  color: C.text,
                }}
              >
                <b style={{ color: C.gold }}>{p.number}</b> {p.shortDirection}
              </span>
              {gate ? (
                <span
                  style={{
                    position: "absolute",
                    bottom: 6,
                    left: 6,
                    background: C.gold,
                    color: "#2a171d",
                    borderRadius: 8,
                    padding: "2px 8px",
                    fontWeight: 800,
                  }}
                >
                  {gate.gate}{" "}
                  <span style={{ fontWeight: 500, fontSize: 12 }}>
                    {gate.thai}
                  </span>
                </span>
              ) : null}
              {isMaster ? (
                <span
                  style={{
                    position: "absolute",
                    bottom: 6,
                    right: 6,
                    background: C.fire,
                    color: "#fff",
                    borderRadius: 8,
                    padding: "2px 8px",
                    fontSize: 12,
                  }}
                >
                  ดิถี {digit ?? "?"}{" "}
                  {digit !== null ? ELEMENT_BY_DIGIT[digit] : ""}
                </span>
              ) : null}
              {card ? (
                <span
                  style={{
                    position: "absolute",
                    top: 34,
                    right: 8,
                    color: "#fff",
                    fontSize: 12,
                    textShadow: "0 1px 3px #000",
                  }}
                >
                  #{card.no}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p
        style={{
          color: C.sub,
          fontSize: 12,
          textAlign: "center",
          marginTop: 10,
        }}
      >
        แตะหลังไพ่เพื่อเปิดทีละใบ · ไพ่ไม่ซ้ำภายในรอบ · แตะหน้าไพ่เพื่อดูภาพใหญ่
      </p>

      {zoom ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoom(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "grid",
            placeItems: "center",
            zIndex: 60,
            padding: 20,
          }}
        >
          <div
            style={{
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
              color: C.text,
            }}
          >
            {zoom.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={zoom.imageUrl}
                alt={zoom.name}
                style={{ width: "100%", borderRadius: 16 }}
              />
            ) : null}
            <p style={{ marginTop: 10 }}>
              #{zoom.no} {zoom.name} · {deckInfo.name}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
