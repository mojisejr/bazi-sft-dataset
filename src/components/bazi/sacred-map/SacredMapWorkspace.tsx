"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import { LocationDetailSheet } from "@/components/bazi/sacred-map/LocationDetailSheet";
import { SubmitLocationDialog } from "@/components/bazi/sacred-map/SubmitLocationDialog";
import {
  ELEMENT_LABEL_TH,
  NEED_OPTIONS,
  SACRED_ELEMENTS,
  elementMeta,
  type SacredLocationDto,
} from "@/lib/bazi/sacred-map/constants";
import {
  getCheckedInIds,
  getReminders,
  getSavedIds,
  markCheckedIn,
  setReminder,
  toggleSaved,
} from "@/lib/bazi/sacred-map/local-store";
import { shareLocation } from "@/lib/bazi/sacred-map/share";

const SacredMapView = dynamic(() => import("@/components/bazi/sacred-map/SacredMapView"), {
  ssr: false,
  loading: () => <div className="sacred-map__canvas sacred-map__canvas--loading">กำลังโหลดแผนที่…</div>,
});

export function SacredMapWorkspace() {
  const [locations, setLocations] = useState<SacredLocationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [element, setElement] = useState<string>("");
  const [need, setNeed] = useState<string>("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // สถานะส่วนตัว (localStorage)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [reminders, setReminders] = useState<Record<string, string>>({});

  useEffect(() => {
    setSavedIds(getSavedIds());
    setCheckedInIds(getCheckedInIds());
    setReminders(getReminders());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (element) params.set("element", element);
      if (need) params.set("need", need);
      const res = await fetch(`/api/sacred-map?${params.toString()}`);
      const data = await res.json();
      setLocations(Array.isArray(data.locations) ? data.locations : []);
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [element, need]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (savedOnly ? locations.filter((l) => savedIds.has(l.id)) : locations),
    [locations, savedOnly, savedIds],
  );

  const selected = useMemo(
    () => locations.find((l) => l.id === selectedId) ?? null,
    [locations, selectedId],
  );

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const handleToggleSave = (id: string) => {
    const now = toggleSaved(id);
    setSavedIds(getSavedIds());
    flash(now ? "บันทึกสถานที่แล้ว" : "เอาออกจากที่บันทึกแล้ว");
  };

  const handleCheckin = async (loc: SacredLocationDto) => {
    markCheckedIn(loc.id);
    setCheckedInIds(getCheckedInIds());
    try {
      const res = await fetch("/api/sacred-map/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: loc.id }),
      });
      const data = await res.json();
      if (res.ok && typeof data.checkinCount === "number") {
        setLocations((prev) =>
          prev.map((l) => (l.id === loc.id ? { ...l, checkinCount: data.checkinCount } : l)),
        );
      }
      flash("เช็คอินสำเร็จ 🙏");
    } catch {
      flash("เช็คอินไว้ในเครื่องแล้ว (ออฟไลน์)");
    }
  };

  const handleReminder = (id: string, date: string | null) => {
    setReminder(id, date);
    setReminders(getReminders());
    flash(date ? `ตั้งเตือนวันที่ ${date}` : "ลบการเตือนแล้ว");
  };

  return (
    <div className="sacred-map">
      <div className="sacred-map__intro">
        <SectionHeading title="แผนที่สถานที่ศักดิ์สิทธิ์" />
        <p className="sacred-map__lead">
          ค้นหาสถานที่ไหว้เทพ/ขอพร กรองตามธาตุและเรื่องที่อยากขอ แตะหมุดเพื่อดูโพยการมู ทิศมงคล และเปิด Google Maps
        </p>
      </div>

      <Surface className="sacred-map__filters">
        <div className="sacred-map__filter-group">
          <span className="sacred-map__filter-label">ธาตุ</span>
          <div className="sacred-map__pills">
            <button
              className={`sacred-map__pill ${element === "" ? "sacred-map__pill--on" : ""}`}
              onClick={() => setElement("")}
            >
              ทั้งหมด
            </button>
            {SACRED_ELEMENTS.map((el) => {
              const meta = elementMeta(el)!;
              return (
                <button
                  key={el}
                  className={`sacred-map__pill ${element === el ? "sacred-map__pill--on" : ""}`}
                  style={{ ["--chip" as string]: meta.color }}
                  onClick={() => setElement((cur) => (cur === el ? "" : el))}
                >
                  ธาตุ{ELEMENT_LABEL_TH[el]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sacred-map__filter-group">
          <span className="sacred-map__filter-label">เรื่องที่ขอ</span>
          <div className="sacred-map__pills">
            <button
              className={`sacred-map__pill ${need === "" ? "sacred-map__pill--on" : ""}`}
              onClick={() => setNeed("")}
            >
              ทั้งหมด
            </button>
            {NEED_OPTIONS.map((n) => (
              <button
                key={n}
                className={`sacred-map__pill ${need === n ? "sacred-map__pill--on" : ""}`}
                onClick={() => setNeed((cur) => (cur === n ? "" : n))}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="sacred-map__filter-actions">
          <label className="sacred-map__saved-toggle">
            <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} />
            <span>เฉพาะที่บันทึก ({savedIds.size})</span>
          </label>
          <ActionButton tone="primary" onClick={() => setSubmitOpen(true)}>
            + เสนอสถานที่
          </ActionButton>
        </div>
      </Surface>

      <div className="sacred-map__canvas-wrap">
        <SacredMapView locations={visible} selectedId={selectedId} onSelect={setSelectedId} />
        {loading ? <div className="sacred-map__canvas-overlay">กำลังโหลดสถานที่…</div> : null}
        {!loading && visible.length === 0 ? (
          <div className="sacred-map__canvas-overlay">
            {savedOnly ? "ยังไม่มีสถานที่ที่บันทึกไว้" : "ไม่พบสถานที่ตามตัวกรอง ลองคลายตัวกรองดูนะ"}
          </div>
        ) : null}
      </div>

      <div className="sacred-map__list">
        {visible.map((loc) => {
          const meta = elementMeta(loc.element);
          return (
            <button
              key={loc.id}
              className={`sacred-map__card ${selectedId === loc.id ? "sacred-map__card--active" : ""}`}
              onClick={() => setSelectedId(loc.id)}
            >
              <div className="sacred-map__card-head">
                <span className="sacred-map__card-name">{loc.name}</span>
                {meta ? (
                  <span className="sacred-map__chip" style={{ ["--chip" as string]: meta.color }}>
                    {meta.label}
                  </span>
                ) : null}
              </div>
              {loc.deity ? <span className="sacred-map__card-deity">🙏 {loc.deity}</span> : null}
              <span className="sacred-map__card-meta">
                {loc.province ? `${loc.province} · ` : ""}
                เช็คอิน {loc.checkinCount.toLocaleString("th-TH")}
                {savedIds.has(loc.id) ? " · ★" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="sacred-map__sheet-backdrop" onClick={() => setSelectedId(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <LocationDetailSheet
              location={selected}
              saved={savedIds.has(selected.id)}
              checkedIn={checkedInIds.has(selected.id)}
              reminder={reminders[selected.id] ?? null}
              checkinCount={selected.checkinCount}
              onClose={() => setSelectedId(null)}
              onToggleSave={() => handleToggleSave(selected.id)}
              onCheckin={() => handleCheckin(selected)}
              onSetReminder={(date) => handleReminder(selected.id, date)}
              onShare={async () => flash(await shareLocation(selected))}
            />
          </div>
        </div>
      ) : null}

      {submitOpen ? (
        <SubmitLocationDialog
          onClose={() => setSubmitOpen(false)}
          onSubmitted={() => {
            setSubmitOpen(false);
            flash("ส่งสถานที่ให้แอดมินตรวจแล้ว ขอบคุณนะ 🙏");
          }}
        />
      ) : null}

      {toast ? <div className="sacred-map__toast">{toast}</div> : null}
    </div>
  );
}
