"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { genderLabelTh, type DeckCard, type SwipeDir } from "@/lib/bazi/matchmaker";

export type SwipeCardHandle = { fling: (dir: SwipeDir) => void };

/** อวาตาร์: ใช้รูป mascot ตามหลักวัน ถ้าไม่มีก็ใช้วงกลมไล่สี + อักษรแรกของชื่อ. */
function MatchAvatar({ dayPillar, name }: { dayPillar: string | null; name: string }) {
  const [img, setImg] = useState<{ pillar: string; url: string } | null>(null);
  useEffect(() => {
    if (!dayPillar) return;
    let alive = true;
    fetch(`/api/bazi/mascot/${encodeURIComponent(dayPillar)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { imageUrl?: string } | null) => {
        if (alive && d?.imageUrl) setImg({ pillar: dayPillar, url: d.imageUrl });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [dayPillar]);

  const url = img && img.pillar === dayPillar ? img.url : null;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="lm-card__avatar-img" src={url} alt={`มาสคอตหลักวัน ${dayPillar}`} />;
  }
  return <span className="lm-card__avatar-fallback">{name.slice(0, 1)}</span>;
}

const DRAG_THRESHOLD = 110;

type SwipeCardProps = {
  card: DeckCard;
  /** การ์ดบนสุด (โต้ตอบได้) หรือใบซ้อนด้านหลัง. */
  active: boolean;
  onSwipe: (dir: SwipeDir) => void;
};

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { card, active, onSwipe },
  ref,
) {
  const [dx, setDx] = useState(0);
  const [fly, setFly] = useState<SwipeDir | null>(null);
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const settled = useRef(false);

  const commit = useCallback(
    (dir: SwipeDir) => {
      if (settled.current) return;
      settled.current = true;
      setFly(dir);
      // ให้ transition วิ่งก่อนแจ้ง parent ให้ถอดการ์ด
      window.setTimeout(() => onSwipe(dir), 240);
    },
    [onSwipe],
  );

  // สั่งปัดจากปุ่ม/คีย์บอร์ดภายนอก (เรียกผ่าน ref ในตัวจัดการอีเวนต์)
  useImperativeHandle(ref, () => ({ fling: (dir: SwipeDir) => commit(dir) }), [commit]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!active || settled.current) return;
    dragging.current = true;
    setIsDragging(true);
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setDx(e.clientX - startX.current);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    if (dx > DRAG_THRESHOLD) commit("like");
    else if (dx < -DRAG_THRESHOLD) commit("pass");
    else setDx(0);
  };

  const flyX = fly === "like" ? 1 : fly === "pass" ? -1 : 0;
  const translateX = fly ? flyX * 700 : dx;
  const rotate = fly ? flyX * 18 : dx / 18;
  const likeOpacity = Math.max(0, Math.min(1, dx / DRAG_THRESHOLD));
  const nopeOpacity = Math.max(0, Math.min(1, -dx / DRAG_THRESHOLD));

  const p = card.person;
  const h = card.headline;

  return (
    <article
      className={`lm-card lm-card--${h.tone}${active ? " lm-card--active" : ""}${fly ? " lm-card--flying" : ""}`}
      style={{
        transform: `translateX(${translateX}px) rotate(${rotate}deg)`,
        transition: isDragging ? "none" : "transform 0.24s ease",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="lm-card__stamp lm-card__stamp--like" style={{ opacity: active ? likeOpacity : 0 }}>
        ชอบ ♥
      </div>
      <div className="lm-card__stamp lm-card__stamp--nope" style={{ opacity: active ? nopeOpacity : 0 }}>
        ผ่าน ✕
      </div>

      <header className="lm-card__head">
        <div className="lm-card__avatar">
          <MatchAvatar dayPillar={p.dayPillar} name={p.name} />
        </div>
        <div className="lm-card__id">
          <div className="lm-card__name">
            {p.name}
            {p.age != null ? <span className="lm-card__age">, {p.age}</span> : null}
          </div>
          <div className="lm-card__meta">
            {genderLabelTh(p.gender)}
            {p.dayPillar ? ` · หลักวัน ${p.dayPillar}` : ""}
            {p.elementTh ? ` · ดิถี${p.elementTh}` : ""}
            {p.stageTh ? ` · ${p.stageTh}` : ""}
          </div>
        </div>
        <div className="lm-card__grade" title="เกรดสมพงษ์">
          <span className="lm-card__grade-value">{h.grade}</span>
          <span className="lm-card__grade-caption">สมพงษ์</span>
        </div>
      </header>

      <div className="lm-card__verdict">
        <span className="lm-card__verdict-label">{h.verdict}</span>
        <span className="lm-card__verdict-pct">
          {h.percent != null ? `${h.percent}%` : "—"} {h.emoji ?? ""}
        </span>
      </div>
      <div className="lm-card__headline-facet">{h.label} · {h.pairingLabel}</div>

      {p.bio ? <p className="lm-card__bio">{p.bio}</p> : null}
      {p.tags?.length ? (
        <div className="lm-card__tags">
          {p.tags.map((t) => (
            <span key={t} className="lm-card__tag">#{t}</span>
          ))}
        </div>
      ) : null}

      <div className="lm-card__bars">
        {card.facets.map((f) => (
          <div key={f.key} className={`lm-bar${f.isMain ? " lm-bar--main" : ""}`}>
            <div className="lm-bar__top">
              <span className="lm-bar__label">{f.label}</span>
              <span className="lm-bar__grade">{f.found ? f.grade : "—"}</span>
            </div>
            <div className="lm-bar__track">
              <div className="lm-bar__fill" style={{ width: `${f.found ? f.percent ?? 0 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="lm-card__more" onClick={() => setOpen((v) => !v)}>
        {open ? "ซ่อนรายละเอียด" : "ดูรายละเอียดสมพงษ์"}
      </button>
      {open ? (
        <div className="lm-card__detail">
          {h.ratingText ? <p>{h.ratingText}</p> : null}
          {card.nisai.length ? (
            <ul className="lm-card__nisai">
              {card.nisai.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : null}
          {card.sising ? (
            <p className="lm-card__sising">
              ดาวประจำดวงมิติหลัก: <strong>{card.sising.nameTh}</strong> ({card.sising.nameCn}) — {card.sising.short}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
});
