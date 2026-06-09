"use client";

import { useCallback, useEffect, useState } from "react";

type TopicDefinition = {
  id: string;
  chapter: number;
  title: string;
  lens: string;
  kind: string;
  relationKeys: string[];
  stepNumbers: number[];
};

type DoctrineResponse = {
  merged: TopicDefinition[];
  defaults: TopicDefinition[];
  overrides: Record<string, unknown>;
};

type DraftRow = {
  title: string;
  lens: string;
  stepNumbers: string;
  relationKeys: string;
};

const RELATION_KEYS = ["same", "resource", "output", "power", "wealth"];

function toDraft(t: TopicDefinition): DraftRow {
  return {
    title: t.title,
    lens: t.lens,
    stepNumbers: t.stepNumbers.join(", "),
    relationKeys: t.relationKeys.join(", "),
  };
}

export default function ReadingDoctrineAdminPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<DoctrineResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const authHeaders = useCallback(
    (): HeadersInit => (token.trim() ? { "x-admin-token": token.trim() } : {}),
    [token],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch("/api/reading/doctrine", { headers: authHeaders() });
      if (!res.ok) {
        throw new Error(`โหลดไม่สำเร็จ (${res.status})`);
      }
      const json = (await res.json()) as DoctrineResponse;
      setData(json);
      const nextDrafts: Record<string, DraftRow> = {};
      for (const t of json.merged) {
        nextDrafts[t.id] = toDraft(t);
      }
      setDrafts(nextDrafts);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const setDraft = (id: string, patch: Partial<DraftRow>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const save = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    const stepNumbers = d.stepNumbers
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
    const relationKeys = d.relationKeys
      .split(",")
      .map((s) => s.trim())
      .filter((s) => RELATION_KEYS.includes(s));
    const override: Record<string, unknown> = {};
    if (d.lens.trim()) override.lens = d.lens.trim();
    if (d.title.trim()) override.title = d.title.trim();
    if (stepNumbers.length > 0) override.stepNumbers = stepNumbers;
    if (relationKeys.length > 0) override.relationKeys = relationKeys;

    setStatus(`กำลังบันทึก ${id}...`);
    try {
      const res = await fetch("/api/reading/doctrine", {
        method: "PUT",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ topicId: id, override, updatedBy: "ซินแส (online)" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `บันทึกไม่สำเร็จ (${res.status})`);
      setStatus(`บันทึก ${id} สำเร็จ ✓`);
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  };

  const reset = async (id: string) => {
    setStatus(`กำลังคืนค่า default ${id}...`);
    try {
      const res = await fetch(`/api/reading/doctrine?topicId=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `คืนค่าไม่สำเร็จ (${res.status})`);
      setStatus(`คืนค่า default ${id} สำเร็จ ✓`);
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "คืนค่าไม่สำเร็จ");
    }
  };

  const hasOverride = (id: string) => Boolean(data?.overrides && id in data.overrides);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "Tahoma, sans-serif" }}>
      <h1 style={{ color: "#1F3864" }}>แก้ “วิธีการอ่านรายบท” ออนไลน์ (ซินแส)</h1>
      <p style={{ color: "#555" }}>
        แก้ได้เฉพาะ ชื่อบท / lens / ขั้นที่ใช้ / บทบาทธาตุ — บันทึกแล้วมีผลทันที (engine จะ merge
        ทับค่าในโค้ด และ fallback เป็น default หากมีปัญหา) ส่วน “ตรรกะการอ่าน” ยังต้องแก้ที่โค้ด
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
        <input
          placeholder="admin token (ถ้าตั้ง ADMIN_DOCTRINE_TOKEN ไว้)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
        />
        <button onClick={() => void load()} style={btnStyle}>โหลดใหม่</button>
      </div>

      {status && <p style={{ color: "#7030A0" }}>{status}</p>}
      {loading && <p>กำลังโหลด...</p>}

      {data?.merged.map((t) => {
        const def = data.defaults.find((d) => d.id === t.id);
        const draft = drafts[t.id];
        if (!draft) return null;
        return (
          <section
            key={t.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 16,
              margin: "12px 0",
              background: hasOverride(t.id) ? "#FFF8E1" : "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#1F3864" }}>
                บท {t.chapter} — {t.id} {hasOverride(t.id) ? "(มี override)" : ""}
              </strong>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => void save(t.id)} style={btnStyle}>บันทึก</button>
                <button onClick={() => void reset(t.id)} style={{ ...btnStyle, background: "#aaa" }}>คืนค่า default</button>
              </div>
            </div>

            <label style={labelStyle}>ชื่อบท (title)</label>
            <input value={draft.title} onChange={(e) => setDraft(t.id, { title: e.target.value })} style={inputStyle} />

            <label style={labelStyle}>หลักการอ่าน (lens)</label>
            <textarea value={draft.lens} onChange={(e) => setDraft(t.id, { lens: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} />

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>ขั้นที่ใช้ (1-7, คั่นด้วย ,)</label>
                <input value={draft.stepNumbers} onChange={(e) => setDraft(t.id, { stepNumbers: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>บทบาทธาตุ (same/resource/output/power/wealth)</label>
                <input value={draft.relationKeys} onChange={(e) => setDraft(t.id, { relationKeys: e.target.value })} style={inputStyle} />
              </div>
            </div>

            {def && (
              <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
                default: lens=“{def.lens}” | ขั้น {def.stepNumbers.join(",")} | บทบาท {def.relationKeys.join(",") || "—"}
              </p>
            )}
          </section>
        );
      })}
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 14px",
  background: "#1F3864",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#333",
  marginTop: 10,
  marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  border: "1px solid #ccc",
  borderRadius: 6,
  boxSizing: "border-box",
};
