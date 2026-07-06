"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import {
  DIRECTION_OPTIONS,
  ELEMENT_LABEL_TH,
  NEED_OPTIONS,
  SACRED_ELEMENTS,
} from "@/lib/bazi/sacred-map/constants";

const SacredMapView = dynamic(() => import("@/components/bazi/sacred-map/SacredMapView"), {
  ssr: false,
  loading: () => <div className="sacred-map__canvas sacred-map__canvas--loading">กำลังโหลดแผนที่…</div>,
});

type Props = {
  onClose: () => void;
  onSubmitted: () => void;
};

export function SubmitLocationDialog({ onClose, onSubmitted }: Props) {
  const [name, setName] = useState("");
  const [deity, setDeity] = useState("");
  const [description, setDescription] = useState("");
  const [province, setProvince] = useState("");
  const [address, setAddress] = useState("");
  const [direction, setDirection] = useState("");
  const [element, setElement] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [worshipGuide, setWorshipGuide] = useState("");
  const [contact, setContact] = useState("");
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleNeed = (n: string) =>
    setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("กรุณาใส่ชื่อสถานที่");
    if (!pick) return setError("กรุณาปักหมุดตำแหน่งบนแผนที่");
    setBusy(true);
    try {
      const res = await fetch("/api/sacred-map", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          deity,
          description,
          province,
          address,
          lat: pick.lat,
          lng: pick.lng,
          direction,
          element: element || null,
          needs,
          worshipGuide,
          submitterContact: contact,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "ส่งไม่สำเร็จ");
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sacred-map__modal" role="dialog" aria-label="เสนอสถานที่ใหม่">
      <div className="sacred-map__modal-card">
        <div className="sacred-map__modal-head">
          <h3>เสนอสถานที่ศักดิ์สิทธิ์</h3>
          <button className="sacred-map__sheet-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
        <p className="sacred-map__modal-note">
          สถานที่ที่เสนอจะเข้าคิวรอแอดมินตรวจสอบก่อนขึ้นแผนที่สาธารณะ
        </p>

        <label className="sacred-map__field">
          <span>ชื่อสถานที่ *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ศาลเจ้าพ่อเสือ" />
        </label>
        <label className="sacred-map__field">
          <span>สิ่งศักดิ์สิทธิ์/เทพ</span>
          <input value={deity} onChange={(e) => setDeity(e.target.value)} />
        </label>
        <label className="sacred-map__field">
          <span>รายละเอียด</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </label>

        <div className="sacred-map__field-row">
          <label className="sacred-map__field">
            <span>จังหวัด</span>
            <input value={province} onChange={(e) => setProvince(e.target.value)} />
          </label>
          <label className="sacred-map__field">
            <span>ทิศมงคล</span>
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="">—</option>
              {DIRECTION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="sacred-map__field">
          <span>ที่อยู่</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>

        <div className="sacred-map__field">
          <span>ธาตุ</span>
          <div className="sacred-map__pills">
            <button
              type="button"
              className={`sacred-map__pill ${element === "" ? "sacred-map__pill--on" : ""}`}
              onClick={() => setElement("")}
            >
              ไม่ระบุ
            </button>
            {SACRED_ELEMENTS.map((el) => (
              <button
                type="button"
                key={el}
                className={`sacred-map__pill ${element === el ? "sacred-map__pill--on" : ""}`}
                onClick={() => setElement(el)}
              >
                {ELEMENT_LABEL_TH[el]}
              </button>
            ))}
          </div>
        </div>

        <div className="sacred-map__field">
          <span>ช่วยเรื่อง</span>
          <div className="sacred-map__pills">
            {NEED_OPTIONS.map((n) => (
              <button
                type="button"
                key={n}
                className={`sacred-map__pill ${needs.includes(n) ? "sacred-map__pill--on" : ""}`}
                onClick={() => toggleNeed(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="sacred-map__field">
          <span>โพยการมู (ของไหว้/วิธีขอพร)</span>
          <textarea value={worshipGuide} onChange={(e) => setWorshipGuide(e.target.value)} rows={2} />
        </label>

        <div className="sacred-map__field">
          <span>ปักหมุดตำแหน่ง * {pick ? `(${pick.lat}, ${pick.lng})` : "— คลิกบนแผนที่"}</span>
          <div className="sacred-map__picker">
            <SacredMapView locations={[]} onPick={(lat, lng) => setPick({ lat, lng })} pick={pick} />
          </div>
        </div>

        <label className="sacred-map__field">
          <span>ช่องทางติดต่อคุณ (ถ้ามีข้อสงสัย)</span>
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="LINE ID / เบอร์ / อีเมล" />
        </label>

        {error ? <p className="sacred-map__error">{error}</p> : null}

        <div className="sacred-map__actions">
          <ActionButton onClick={onClose}>ยกเลิก</ActionButton>
          <ActionButton onClick={submit} tone="primary" disabled={busy}>
            {busy ? "กำลังส่ง…" : "ส่งให้แอดมินตรวจ"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
