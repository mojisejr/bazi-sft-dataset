"use client";

import { useEffect, useState } from "react";

/**
 * รูป mascot ตามเสาวัน (60 กะจื่อ) — แสดงบนหน้าจอเท่านั้น (ไม่ติดไป PDF/Word)
 * fetch /api/bazi/mascot/<ganzhi> → รูป + ชื่อไทย/อังกฤษ; ซ่อนเงียบถ้าไม่พบ
 */
type MascotData = {
  ganzhi: string;
  nameTh: string;
  nameEn: string;
  imageUrl: string;
  imageUrlV2?: string | null;
};

export function MascotBadge({ dayStem, dayBranch }: { dayStem?: string; dayBranch?: string }) {
  const [data, setData] = useState<MascotData | null>(null);
  const ganzhi = dayStem && dayBranch ? `${dayStem}${dayBranch}` : "";

  useEffect(() => {
    if (!ganzhi) {
      setData(null);
      return;
    }
    let alive = true;
    setData(null);
    fetch(`/api/bazi/mascot/${encodeURIComponent(ganzhi)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MascotData | null) => {
        // ชุด v2 (scenic) อยู่บน Supabase ปัจจุบัน — ใช้ก่อน ถ้าไม่มีค่อย fallback เดิม
        const url = d?.imageUrlV2 || d?.imageUrl;
        if (alive && url) setData(d ? { ...d, imageUrl: url } : null);
      })
      .catch(() => {
        /* ซ่อนเงียบ */
      });
    return () => {
      alive = false;
    };
  }, [ganzhi]);

  if (!data) return null;

  return (
    <figure className="mascot-badge">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mascot-badge__img" src={data.imageUrl} alt={`mascot ${data.nameTh} (${data.nameEn})`} />
      <figcaption className="mascot-badge__caption">
        {data.nameTh} · {data.nameEn}
      </figcaption>
    </figure>
  );
}
