"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import { RELATIONSHIP_META } from "@/components/bazi/pair/pair-presentation";
import { SwipeCard, type SwipeCardHandle } from "@/components/bazi/matchmaker/SwipeCard";
import {
  genderLabelTh,
  oppositeGender,
  type DeckCard,
  type GenderFilter,
  type MatchRecord,
  type PersonCard,
  type SwipeDir,
} from "@/lib/bazi/matchmaker";
import type { RelationshipType } from "@/lib/bazi/pair-types";

const REL_OPTIONS: RelationshipType[] = ["love", "partner", "boss", "subordinate"];
const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
  { value: "all", label: "ทุกเพศ" },
  { value: "female", label: "หญิง" },
  { value: "male", label: "ชาย" },
];

type Phase = "pick" | "loading" | "swiping" | "done";

function swipedKey(selfId: string) {
  return `love-match:swiped:${selfId}`;
}
function matchesKey(selfId: string) {
  return `love-match:matches:${selfId}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* เก็บไม่ได้ก็ข้าม */
  }
}

export function LoveMatchWorkspace() {
  const [roster, setRoster] = useState<PersonCard[] | null>(null);
  const [usingSamples, setUsingSamples] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [gender, setGender] = useState<GenderFilter>("all");
  const [relationship, setRelationship] = useState<RelationshipType>("love");

  const [phase, setPhase] = useState<Phase>("pick");
  const [self, setSelf] = useState<PersonCard | null>(null);
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [history, setHistory] = useState<{ card: DeckCard; matched: boolean }[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [matchModal, setMatchModal] = useState<DeckCard | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeCardRef = useRef<SwipeCardHandle | null>(null);

  // โหลดโรสเตอร์ตอนเปิดหน้า
  useEffect(() => {
    let alive = true;
    fetch("/api/bazi/matchmaker")
      .then((r) => r.json())
      .then((data: { people?: PersonCard[]; usingSamples?: boolean }) => {
        if (!alive) return;
        setRoster(data.people ?? []);
        setUsingSamples(Boolean(data.usingSamples));
      })
      .catch(() => {
        if (alive) setRoster([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // ตั้งค่าเพศเริ่มต้นตามเพศตรงข้ามของตัวเราที่เลือก
  useEffect(() => {
    if (!selfId || !roster) return;
    const me = roster.find((p) => p.id === selfId);
    if (me) setGender(oppositeGender(me.gender));
  }, [selfId, roster]);

  const startSwiping = useCallback(async () => {
    if (!selfId) return;
    setPhase("loading");
    setError(null);
    try {
      const params = new URLSearchParams({ selfId, gender, relationship });
      const res = await fetch(`/api/bazi/matchmaker?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "โหลดเด็คไม่สำเร็จ");
      const swiped = new Set(readJson<string[]>(swipedKey(selfId), []));
      const fresh = (data.deck as DeckCard[]).filter((c) => !swiped.has(c.person.id));
      setSelf(data.self as PersonCard);
      setDeck(fresh);
      setIdx(0);
      setHistory([]);
      setMatches(readJson<MatchRecord[]>(matchesKey(selfId), []));
      setPhase(fresh.length ? "swiping" : "done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setPhase("pick");
    }
  }, [selfId, gender, relationship]);

  const persistSwipe = useCallback(
    (card: DeckCard, matched: boolean) => {
      if (!selfId) return;
      const swiped = readJson<string[]>(swipedKey(selfId), []);
      if (!swiped.includes(card.person.id)) {
        writeJson(swipedKey(selfId), [...swiped, card.person.id]);
      }
      if (matched) {
        const rec: MatchRecord = {
          personId: card.person.id,
          name: card.person.name,
          dayPillar: card.person.dayPillar,
          percent: card.headline.percent,
          grade: card.headline.grade,
          verdict: card.headline.verdict,
          headlineLabel: card.headline.label,
          at: Date.now(),
        };
        setMatches((cur) => {
          const next = [rec, ...cur.filter((m) => m.personId !== rec.personId)];
          writeJson(matchesKey(selfId), next);
          return next;
        });
      }
    },
    [selfId],
  );

  const handleSwipe = useCallback(
    (dir: SwipeDir) => {
      const card = deck[idx];
      if (!card) return;
      const matched = dir === "like" && card.likesBack;
      persistSwipe(card, matched);
      setHistory((h) => [...h, { card, matched }]);
      if (matched) setMatchModal(card);
      setIdx((i) => {
        const next = i + 1;
        if (next >= deck.length) setPhase("done");
        return next;
      });
    },
    [deck, idx, persistSwipe],
  );

  const rewind = useCallback(() => {
    if (!history.length || !selfId) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setIdx((i) => Math.max(0, i - 1));
    setPhase("swiping");
    // เอา id ออกจาก swiped + ถอนแมตช์ถ้ามี
    const swiped = readJson<string[]>(swipedKey(selfId), []).filter((id) => id !== last.card.person.id);
    writeJson(swipedKey(selfId), swiped);
    if (last.matched) {
      setMatches((cur) => {
        const next = cur.filter((m) => m.personId !== last.card.person.id);
        writeJson(matchesKey(selfId), next);
        return next;
      });
    }
  }, [history, selfId]);

  const button = useCallback((dir: SwipeDir) => {
    activeCardRef.current?.fling(dir);
  }, []);

  // คีย์ลูกศรซ้าย/ขวา
  useEffect(() => {
    if (phase !== "swiping") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") button("pass");
      else if (e.key === "ArrowRight") button("like");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, button]);

  const remaining = deck.length - idx;
  const stack = useMemo(() => deck.slice(idx, idx + 3), [deck, idx]);

  const backToPick = useCallback(() => {
    setPhase("pick");
    setDeck([]);
    setIdx(0);
    setHistory([]);
    setMatchModal(null);
  }, []);

  const resetSwipes = useCallback(() => {
    if (!selfId) return;
    if (!window.confirm("ล้างประวัติการปัด + แมตช์ของดวงนี้ทั้งหมด?")) return;
    writeJson(swipedKey(selfId), []);
    writeJson(matchesKey(selfId), []);
    setMatches([]);
    void startSwiping();
  }, [selfId, startSwiping]);

  return (
    <div className="lm-shell">
      <Surface as="section" inset>
        <SectionHeading
          kicker="จับคู่สมพงษ์"
          title="ปัดหาคู่ที่ดวงเข้ากัน 🔥"
          note="เลือก “ตัวเรา” แล้วปัดขวาเพื่อชอบ ปัดซ้ายเพื่อผ่าน — การ์ดจะโชว์เกรดสมพงษ์รายคู่ก่อนตัดสินใจ"
        />

        {phase === "pick" ? (
          <div className="lm-pick">
            <div className="lm-pick__prefs">
              <label className="field field--compact">
                <span>โหมดจับคู่</span>
                <select value={relationship} onChange={(e) => setRelationship(e.target.value as RelationshipType)}>
                  {REL_OPTIONS.map((r) => (
                    <option key={r} value={r}>{RELATIONSHIP_META[r].label}</option>
                  ))}
                </select>
              </label>
              <label className="field field--compact">
                <span>อยากดูเพศ</span>
                <select value={gender} onChange={(e) => setGender(e.target.value as GenderFilter)}>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <p className="lm-pick__hint">เลือกดวง “ตัวเรา” จากคนที่ผูกดวงไว้ในระบบ:</p>
            {usingSamples ? (
              <p className="lm-note">* ยังไม่มีดวงในระบบ — กำลังใช้ดวงตัวอย่างเพื่อทดสอบ (seed ได้ด้วย <code>npm run db:seed:matchmaker</code>)</p>
            ) : null}

            {roster == null ? (
              <p className="lm-note">กำลังโหลดรายชื่อ…</p>
            ) : roster.length === 0 ? (
              <p className="lm-note">ยังไม่มีดวงในระบบ</p>
            ) : (
              <div className="lm-roster">
                {roster.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`lm-roster__item${selfId === p.id ? " lm-roster__item--sel" : ""}`}
                    onClick={() => setSelfId(p.id)}
                  >
                    <span className="lm-roster__name">{p.name}</span>
                    <span className="lm-roster__meta">
                      {genderLabelTh(p.gender)}
                      {p.age != null ? ` · ${p.age} ปี` : ""}
                      {p.dayPillar ? ` · ${p.dayPillar}` : ""}
                    </span>
                    {p.source === "sample" ? <span className="lm-roster__badge">ตัวอย่าง</span> : null}
                  </button>
                ))}
              </div>
            )}

            {error ? <p className="lm-error">{error}</p> : null}
            <div className="lm-pick__actions">
              <ActionButton tone="primary" type="button" disabled={!selfId} onClick={() => void startSwiping()}>
                เริ่มปัด →
              </ActionButton>
              {selfId ? (
                <span className="lm-pick__note">
                  ตัวเรา: <strong>{roster?.find((p) => p.id === selfId)?.name}</strong> · อีกฝ่ายจะปัดกลับให้เมื่อเกรดสมพงษ์ถึง B- ขึ้นไป
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </Surface>

      {phase === "loading" ? (
        <Surface as="section" inset>
          <p className="lm-note">กำลังคำนวณสมพงษ์กับทุกคน…</p>
        </Surface>
      ) : null}

      {phase === "swiping" || phase === "done" ? (
        <Surface as="section" inset className="lm-play">
          <div className="lm-play__bar">
            <div className="lm-play__self">
              ตัวเรา: <strong>{self?.name}</strong>
              {self?.dayPillar ? ` · ${self.dayPillar}` : ""} · โหมด{RELATIONSHIP_META[relationship].label}
            </div>
            <div className="lm-play__actions">
              <button type="button" className="lm-chip" onClick={() => setShowMatches((v) => !v)}>
                💘 แมตช์ ({matches.length})
              </button>
              <button type="button" className="lm-chip" onClick={backToPick}>
                เปลี่ยนตัวเรา
              </button>
            </div>
          </div>

          {phase === "swiping" ? (
            <>
              <div className="lm-deck">
                {stack
                  .map((card, i) => ({ card, i }))
                  .reverse()
                  .map(({ card, i }) => (
                    <div
                      key={card.person.id}
                      className={`lm-deck__slot${i === 0 ? " lm-deck__slot--active" : ""}`}
                      style={{
                        transform: `translateY(${i * 10}px) scale(${1 - i * 0.04})`,
                        zIndex: stack.length - i,
                        opacity: i > 1 ? 0 : 1,
                      }}
                    >
                      <SwipeCard
                        ref={i === 0 ? activeCardRef : undefined}
                        card={card}
                        active={i === 0}
                        onSwipe={handleSwipe}
                      />
                    </div>
                  ))}
              </div>

              <div className="lm-controls">
                <button type="button" className="lm-btn lm-btn--nope" onClick={() => button("pass")} title="ผ่าน (←)">
                  ✕
                </button>
                <button
                  type="button"
                  className="lm-btn lm-btn--rewind"
                  onClick={rewind}
                  disabled={!history.length}
                  title="ย้อนกลับ"
                >
                  ↺
                </button>
                <button type="button" className="lm-btn lm-btn--like" onClick={() => button("like")} title="ชอบ (→)">
                  ♥
                </button>
              </div>
              <p className="lm-play__count">เหลืออีก {remaining} คน</p>
            </>
          ) : (
            <div className="lm-done">
              <div className="lm-done__emoji">🎉</div>
              <h3>ปัดครบทุกคนแล้ว!</h3>
              <p>คุณแมตช์กับ <strong>{matches.length}</strong> คนในโหมดนี้</p>
              <div className="lm-done__actions">
                <ActionButton type="button" onClick={() => setShowMatches(true)}>ดูรายการแมตช์</ActionButton>
                <ActionButton type="button" onClick={backToPick}>เปลี่ยนตัวเรา / โหมด</ActionButton>
                <button type="button" className="lm-chip lm-chip--danger" onClick={resetSwipes}>
                  ล้างประวัติแล้วปัดใหม่
                </button>
              </div>
            </div>
          )}
        </Surface>
      ) : null}

      {/* It's a Match! */}
      {matchModal ? (
        <div className="lm-match-overlay" role="dialog" aria-modal="true" onClick={() => setMatchModal(null)}>
          <div className="lm-match" onClick={(e) => e.stopPropagation()}>
            <div className="lm-match__spark">✨💘✨</div>
            <h2 className="lm-match__title">แมตช์กันแล้ว!</h2>
            <p className="lm-match__names">
              {self?.name} <span>×</span> {matchModal.person.name}
            </p>
            <div className="lm-match__grade">
              เกรดสมพงษ์ <strong>{matchModal.headline.grade}</strong> · {matchModal.headline.percent ?? "—"}%
              <div className="lm-match__verdict">{matchModal.headline.verdict}</div>
            </div>
            {matchModal.headline.ratingText ? (
              <p className="lm-match__text">{matchModal.headline.ratingText}</p>
            ) : null}
            <ActionButton tone="primary" type="button" onClick={() => setMatchModal(null)}>
              ปัดต่อ
            </ActionButton>
          </div>
        </div>
      ) : null}

      {/* Matches drawer */}
      {showMatches ? (
        <div className="lm-match-overlay" role="dialog" aria-modal="true" onClick={() => setShowMatches(false)}>
          <div className="lm-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="lm-drawer__head">
              <h3>แมตช์ของฉัน ({matches.length})</h3>
              <button type="button" className="lm-chip" onClick={() => setShowMatches(false)}>ปิด</button>
            </div>
            {matches.length === 0 ? (
              <p className="lm-note">ยังไม่มีแมตช์ — ปัดขวาให้คนที่เกรดสมพงษ์ดี ๆ สิ</p>
            ) : (
              <ul className="lm-drawer__list">
                {matches.map((m) => (
                  <li key={m.personId} className="lm-drawer__item">
                    <span className="lm-drawer__grade">{m.grade}</span>
                    <span className="lm-drawer__name">
                      {m.name}
                      {m.dayPillar ? <span className="lm-drawer__pillar"> · {m.dayPillar}</span> : null}
                    </span>
                    <span className="lm-drawer__verdict">{m.verdict} · {m.percent ?? "—"}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
