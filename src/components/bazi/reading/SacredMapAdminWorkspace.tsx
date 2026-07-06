"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import {
  DIRECTION_OPTIONS,
  ELEMENT_LABEL_TH,
  NEED_OPTIONS,
  SACRED_ELEMENTS,
  type SacredLocationDto,
  type SacredStatus,
} from "@/lib/bazi/sacred-map/constants";

const SacredMapView = dynamic(() => import("@/components/bazi/sacred-map/SacredMapView"), {
  ssr: false,
  loading: () => <div className="sacred-map__canvas sacred-map__canvas--loading">กำลังโหลดแผนที่…</div>,
});

type Draft = {
  id?: string;
  name: string;
  deity: string;
  description: string;
  province: string;
  address: string;
  lat: string;
  lng: string;
  direction: string;
  element: string;
  needs: string[];
  worshipGuide: string;
  imageUrl: string;
  googleMapUrl: string;
};

const EMPTY: Draft = {
  name: "",
  deity: "",
  description: "",
  province: "",
  address: "",
  lat: "",
  lng: "",
  direction: "",
  element: "",
  needs: [],
  worshipGuide: "",
  imageUrl: "",
  googleMapUrl: "",
};

const STATUS_LABEL: Record<SacredStatus, string> = {
  pending: "รอตรวจ",
  verified: "เผยแพร่",
  rejected: "ปฏิเสธ",
};

function toDraft(loc: SacredLocationDto): Draft {
  return {
    id: loc.id,
    name: loc.name,
    deity: loc.deity ?? "",
    description: loc.description ?? "",
    province: loc.province ?? "",
    address: loc.address ?? "",
    lat: String(loc.lat),
    lng: String(loc.lng),
    direction: loc.direction ?? "",
    element: loc.element ?? "",
    needs: loc.needs ?? [],
    worshipGuide: loc.worshipGuide ?? "",
    imageUrl: loc.imageUrl ?? "",
    googleMapUrl: loc.googleMapUrl ?? "",
  };
}

export function SacredMapAdminWorkspace() {
  const [token, setToken] = useState("");
  const [locations, setLocations] = useState<SacredLocationDto[]>([]);
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [filter, setFilter] = useState<"all" | SacredStatus>("all");

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (token.trim()) h["x-admin-token"] = token.trim();
    return h;
  }, [token]);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/reading/sacred-map", {
        headers: token.trim() ? { "x-admin-token": token.trim() } : {},
      });
      const body = await res.json();
      if (!res.ok) {
        setStatus(body?.error?.message ?? "โหลดไม่สำเร็จ");
        return;
      }
      setLocations(Array.isArray(body.locations) ? body.locations : []);
      setStatus("");
    } catch {
      setStatus("โหลดไม่สำเร็จ");
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveToken = () => {
    void reload();
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const toggleNeed = (n: string) =>
    setDraft((prev) => ({
      ...prev,
      needs: prev.needs.includes(n) ? prev.needs.filter((x) => x !== n) : [...prev.needs, n],
    }));

  const submit = async () => {
    if (!draft.name.trim()) return setStatus("ต้องมีชื่อสถานที่");
    const lat = Number(draft.lat);
    const lng = Number(draft.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setStatus("พิกัดไม่ถูกต้อง");

    const payload = {
      id: draft.id,
      name: draft.name,
      deity: draft.deity,
      description: draft.description,
      province: draft.province,
      address: draft.address,
      lat,
      lng,
      direction: draft.direction,
      element: draft.element || null,
      needs: draft.needs,
      worshipGuide: draft.worshipGuide,
      imageUrl: draft.imageUrl,
      googleMapUrl: draft.googleMapUrl,
    };

    try {
      const res = await fetch("/api/reading/sacred-map", {
        method: draft.id ? "PUT" : "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) return setStatus(body?.error?.message ?? "บันทึกไม่สำเร็จ");
      setStatus(draft.id ? "แก้ไขแล้ว" : "เพิ่มแล้ว");
      setDraft(EMPTY);
      void reload();
    } catch {
      setStatus("บันทึกไม่สำเร็จ");
    }
  };

  const changeStatus = async (id: string, next: SacredStatus) => {
    try {
      const res = await fetch("/api/reading/sacred-map", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ id, status: next }),
      });
      const body = await res.json();
      if (!res.ok) return setStatus(body?.error?.message ?? "เปลี่ยนสถานะไม่สำเร็จ");
      void reload();
    } catch {
      setStatus("เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("ลบสถานที่นี้?")) return;
    try {
      const res = await fetch(`/api/reading/sacred-map?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: token.trim() ? { "x-admin-token": token.trim() } : {},
      });
      const body = await res.json();
      if (!res.ok) return setStatus(body?.error?.message ?? "ลบไม่สำเร็จ");
      if (draft.id === id) setDraft(EMPTY);
      void reload();
    } catch {
      setStatus("ลบไม่สำเร็จ");
    }
  };

  const shown = useMemo(
    () => (filter === "all" ? locations : locations.filter((l) => l.status === filter)),
    [locations, filter],
  );

  const pick = useMemo(() => {
    const lat = Number(draft.lat);
    const lng = Number(draft.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && draft.lat !== "" ? { lat, lng } : null;
  }, [draft.lat, draft.lng]);

  const pendingCount = locations.filter((l) => l.status === "pending").length;

  return (
    <div className="sacred-map-admin newdata-admin">
      <div className="sacred-map-admin__token">
        <input
          type="password"
          placeholder="admin token (ถ้าตั้ง ADMIN_DOCTRINE_TOKEN)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <ActionButton onClick={saveToken}>ใช้ token</ActionButton>
        {status ? <span className="sacred-map-admin__status">{status}</span> : null}
      </div>

      <div className="sacred-map-admin__grid">
        <section className="sacred-map-admin__form">
          <h3>{draft.id ? "แก้ไขสถานที่" : "เพิ่มสถานที่ใหม่"}</h3>

          <label className="sacred-map__field">
            <span>ชื่อสถานที่ *</span>
            <input value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="sacred-map__field">
            <span>สิ่งศักดิ์สิทธิ์/เทพ</span>
            <input value={draft.deity} onChange={(e) => set("deity", e.target.value)} />
          </label>
          <label className="sacred-map__field">
            <span>รายละเอียด</span>
            <textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </label>

          <div className="sacred-map__field-row">
            <label className="sacred-map__field">
              <span>จังหวัด</span>
              <input value={draft.province} onChange={(e) => set("province", e.target.value)} />
            </label>
            <label className="sacred-map__field">
              <span>ทิศมงคล</span>
              <select value={draft.direction} onChange={(e) => set("direction", e.target.value)}>
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
            <input value={draft.address} onChange={(e) => set("address", e.target.value)} />
          </label>

          <div className="sacred-map__field">
            <span>ธาตุ</span>
            <div className="sacred-map__pills">
              <button
                type="button"
                className={`sacred-map__pill ${draft.element === "" ? "sacred-map__pill--on" : ""}`}
                onClick={() => set("element", "")}
              >
                ไม่ระบุ
              </button>
              {SACRED_ELEMENTS.map((el) => (
                <button
                  type="button"
                  key={el}
                  className={`sacred-map__pill ${draft.element === el ? "sacred-map__pill--on" : ""}`}
                  onClick={() => set("element", el)}
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
                  className={`sacred-map__pill ${draft.needs.includes(n) ? "sacred-map__pill--on" : ""}`}
                  onClick={() => toggleNeed(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <label className="sacred-map__field">
            <span>โพยการมู</span>
            <textarea value={draft.worshipGuide} onChange={(e) => set("worshipGuide", e.target.value)} rows={2} />
          </label>

          <div className="sacred-map__field-row">
            <label className="sacred-map__field">
              <span>ลิงก์รูป (URL)</span>
              <input value={draft.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} />
            </label>
            <label className="sacred-map__field">
              <span>ลิงก์ Google Maps (ถ้ามี)</span>
              <input value={draft.googleMapUrl} onChange={(e) => set("googleMapUrl", e.target.value)} />
            </label>
          </div>

          <div className="sacred-map__field-row">
            <label className="sacred-map__field">
              <span>Lat *</span>
              <input value={draft.lat} onChange={(e) => set("lat", e.target.value)} inputMode="decimal" />
            </label>
            <label className="sacred-map__field">
              <span>Lng *</span>
              <input value={draft.lng} onChange={(e) => set("lng", e.target.value)} inputMode="decimal" />
            </label>
          </div>

          <div className="sacred-map__field">
            <span>คลิกแผนที่เพื่อปักหมุด</span>
            <div className="sacred-map__picker">
              <SacredMapView
                locations={[]}
                onPick={(lat, lng) => {
                  set("lat", String(lat));
                  set("lng", String(lng));
                }}
                pick={pick}
              />
            </div>
          </div>

          <div className="sacred-map__actions">
            {draft.id ? <ActionButton onClick={() => setDraft(EMPTY)}>ล้างฟอร์ม</ActionButton> : null}
            <ActionButton tone="primary" onClick={submit}>
              {draft.id ? "บันทึกการแก้ไข" : "เพิ่มสถานที่"}
            </ActionButton>
          </div>
        </section>

        <section className="sacred-map-admin__list">
          <div className="sacred-map-admin__filters">
            {(["all", "pending", "verified", "rejected"] as const).map((f) => (
              <button
                key={f}
                className={`sacred-map__pill ${filter === f ? "sacred-map__pill--on" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "ทั้งหมด" : STATUS_LABEL[f]}
                {f === "pending" && pendingCount ? ` (${pendingCount})` : ""}
              </button>
            ))}
          </div>

          {shown.map((loc) => (
            <div key={loc.id} className={`sacred-map-admin__row sacred-map-admin__row--${loc.status}`}>
              <div className="sacred-map-admin__row-main">
                <span className="sacred-map-admin__row-name">
                  {loc.name}
                  {loc.source === "user" ? <span className="sacred-map-admin__badge">ผู้ใช้เสนอ</span> : null}
                </span>
                <span className="sacred-map-admin__row-meta">
                  {STATUS_LABEL[loc.status]} · {loc.deity ?? "—"} · เช็คอิน {loc.checkinCount}
                  {loc.submitterContact ? ` · ติดต่อ: ${loc.submitterContact}` : ""}
                </span>
              </div>
              <div className="sacred-map-admin__row-actions">
                {loc.status !== "verified" ? (
                  <button className="sacred-map__link-btn" onClick={() => changeStatus(loc.id, "verified")}>
                    ✓ เผยแพร่
                  </button>
                ) : null}
                {loc.status !== "rejected" ? (
                  <button className="sacred-map__link-btn" onClick={() => changeStatus(loc.id, "rejected")}>
                    ✕ ปฏิเสธ
                  </button>
                ) : null}
                <button className="sacred-map__link-btn" onClick={() => setDraft(toDraft(loc))}>
                  แก้
                </button>
                <button className="sacred-map__link-btn sacred-map__link-btn--danger" onClick={() => remove(loc.id)}>
                  ลบ
                </button>
              </div>
            </div>
          ))}
          {shown.length === 0 ? <p className="sacred-map-admin__empty">ยังไม่มีสถานที่ในหมวดนี้</p> : null}
        </section>
      </div>
    </div>
  );
}
