"use client";

import { useState } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import {
  elementMeta,
  googleMapsLink,
  type SacredLocationDto,
} from "@/lib/bazi/sacred-map/constants";

type Props = {
  location: SacredLocationDto;
  saved: boolean;
  checkedIn: boolean;
  reminder: string | null;
  checkinCount: number;
  onClose: () => void;
  onToggleSave: () => void;
  onCheckin: () => void;
  onSetReminder: (date: string | null) => void;
  onShare: () => void;
};

function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function LocationDetailSheet({
  location,
  saved,
  checkedIn,
  reminder,
  checkinCount,
  onClose,
  onToggleSave,
  onCheckin,
  onSetReminder,
  onShare,
}: Props) {
  const [showReminder, setShowReminder] = useState(false);
  const el = elementMeta(location.element);
  const mapUrl = googleMapsLink(location);

  return (
    <div className="sacred-map__sheet" role="dialog" aria-label={location.name}>
      <button className="sacred-map__sheet-close" onClick={onClose} aria-label="ปิด">
        ✕
      </button>

      {location.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="sacred-map__sheet-img" src={location.imageUrl} alt={location.name} />
      ) : null}

      <div className="sacred-map__sheet-head">
        <h3 className="sacred-map__sheet-title">{location.name}</h3>
        {el ? (
          <span className="sacred-map__chip" style={{ ["--chip" as string]: el.color }}>
            ธาตุ{el.label}
          </span>
        ) : null}
      </div>

      {location.deity ? <p className="sacred-map__sheet-deity">🙏 {location.deity}</p> : null}
      {location.description ? <p className="sacred-map__sheet-desc">{location.description}</p> : null}

      <dl className="sacred-map__facts">
        {location.direction ? (
          <div>
            <dt>ทิศมงคล</dt>
            <dd>{location.direction}</dd>
          </div>
        ) : null}
        {location.province ? (
          <div>
            <dt>จังหวัด</dt>
            <dd>{location.province}</dd>
          </div>
        ) : null}
        {location.address ? (
          <div>
            <dt>ที่อยู่</dt>
            <dd>{location.address}</dd>
          </div>
        ) : null}
        {location.needs.length ? (
          <div>
            <dt>ช่วยเรื่อง</dt>
            <dd>{location.needs.join(" · ")}</dd>
          </div>
        ) : null}
        <div>
          <dt>เช็คอินแล้ว</dt>
          <dd>{checkinCount.toLocaleString("th-TH")} ครั้ง</dd>
        </div>
      </dl>

      {location.worshipGuide ? (
        <div className="sacred-map__guide">
          <h4>โพยการมู</h4>
          <p>{location.worshipGuide}</p>
        </div>
      ) : null}

      {reminder ? (
        <p className="sacred-map__reminder-note">⏰ ตั้งเตือนไว้วันที่ {reminder}</p>
      ) : null}

      {showReminder ? (
        <div className="sacred-map__reminder-row">
          <input
            type="date"
            min={todayBangkok()}
            defaultValue={reminder ?? ""}
            onChange={(e) => onSetReminder(e.target.value || null)}
            aria-label="วันที่ตั้งเตือน"
          />
          {reminder ? (
            <button
              className="sacred-map__link-btn"
              onClick={() => {
                onSetReminder(null);
                setShowReminder(false);
              }}
            >
              ลบเตือน
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="sacred-map__actions">
        <a className="secondary-action" href={mapUrl} target="_blank" rel="noreferrer">
          🗺️ เปิด Google Maps
        </a>
        <ActionButton onClick={onToggleSave} tone={saved ? "primary" : "secondary"}>
          {saved ? "★ บันทึกแล้ว" : "☆ บันทึก"}
        </ActionButton>
        <ActionButton onClick={onCheckin} disabled={checkedIn}>
          {checkedIn ? "✓ เช็คอินแล้ว" : "📍 เช็คอิน"}
        </ActionButton>
        <ActionButton onClick={() => setShowReminder((v) => !v)}>⏰ ตั้งเตือน</ActionButton>
        <ActionButton onClick={onShare}>↗ แชร์</ActionButton>
      </div>
    </div>
  );
}
