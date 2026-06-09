"use client";

import { useCallback, useEffect, useState } from "react";

type Scope = "step" | "role" | "star";

type GetResponse = {
  defaults: {
    step: Record<string, { stepNumber: number; title: string; auditFocus: string }>;
    role: Record<string, { label: string; meaning: string }>;
    star: Record<string, { starName: string; meaning: string }>;
  };
  overrides: {
    steps: Record<string, { title?: string; auditFocus?: string }>;
    roles: Record<string, { label?: string; meaning?: string }>;
    stars: Record<string, { starName?: string; meaning?: string }>;
  };
};

type DraftRow = { surface: string; entityKey: string; value: Record<string, string> };

const FIELDS: Record<Scope, { a: string; b: string; aLabel: string; bLabel: string }> = {
  step: { a: "title", b: "auditFocus", aLabel: "ชื่อขั้น (title)", bLabel: "โฟกัสการอ่าน (auditFocus)" },
  role: { a: "label", b: "meaning", aLabel: "ป้าย (label)", bLabel: "ความหมาย (meaning)" },
  star: { a: "starName", b: "meaning", aLabel: "ชื่อดาว (starName)", bLabel: "ความหมาย (meaning)" },
};
const SCOPE_TITLE: Record<Scope, string> = {
  step: "นิยาม 7 ขั้น (Step)",
  role: "ป้าย/ความหมายบทบาทธาตุ (Role)",
  star: "ดาวพิเศษ (Star)",
};
const SAMPLE_BIRTH = { birthDate: "1993-11-24", birthTime: "15:09", gender: "male", province: "กรุงเทพมหานคร" };

export default function DoctrineConfigAdminPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<GetResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({}); // entityKey -> value
  const [editing, setEditing] = useState<Record<string, { a: string; b: string }>>({});
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<string>("");

  const authHeaders = useCallback(
    (): HeadersInit => (token.trim() ? { "x-admin-token": token.trim() } : {}),
    [token],
  );
  const ck = (scope: Scope, key: string) => `config:${scope}:${key}`;
  const ekey = (scope: Scope, key: string) => `${scope}:${key}`;

  const load = useCallback(async () => {
    setStatus("");
    try {
      const [cfgRes, draftRes] = await Promise.all([
        fetch("/api/reading/doctrine-config", { headers: authHeaders() }),
        fetch("/api/reading/doctrine-draft", { headers: authHeaders() }),
      ]);
      if (!cfgRes.ok) throw new Error(`โหลดไม่สำเร็จ (${cfgRes.status})`);
      const cfg = (await cfgRes.json()) as GetResponse;
      const draftJson = draftRes.ok ? ((await draftRes.json()) as { drafts: DraftRow[] }) : { drafts: [] };
      const draftMap: Record<string, Record<string, string>> = {};
      for (const d of draftJson.drafts) {
        if (d.surface === "config") draftMap[d.entityKey] = d.value;
      }
      setData(cfg);
      setDrafts(draftMap);

      const nextEditing: Record<string, { a: string; b: string }> = {};
      (["step", "role", "star"] as Scope[]).forEach((scope) => {
        const defs = cfg.defaults[scope] as Record<string, Record<string, string | number>>;
        const ovrKey = scope === "step" ? "steps" : scope === "role" ? "roles" : "stars";
        const ovr = cfg.overrides[ovrKey as keyof GetResponse["overrides"]] as Record<string, Record<string, string>>;
        const f = FIELDS[scope];
        for (const key of Object.keys(defs)) {
          const draftVal = draftMap[ekey(scope, key)];
          nextEditing[ck(scope, key)] = {
            a: draftVal?.[f.a] ?? ovr?.[key]?.[f.a] ?? String(defs[key][f.a] ?? ""),
            b: draftVal?.[f.b] ?? ovr?.[key]?.[f.b] ?? String(defs[key][f.b] ?? ""),
          };
        }
      });
      setEditing(nextEditing);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const setEdit = (scope: Scope, key: string, patch: Partial<{ a: string; b: string }>) =>
    setEditing((prev) => ({ ...prev, [ck(scope, key)]: { ...prev[ck(scope, key)], ...patch } }));

  const saveDraft = async (scope: Scope, key: string) => {
    const f = FIELDS[scope];
    const e = editing[ck(scope, key)];
    if (!e) return;
    const value: Record<string, string> = {};
    if (e.a.trim()) value[f.a] = e.a.trim();
    if (e.b.trim()) value[f.b] = e.b.trim();
    setStatus(`กำลังบันทึกร่าง ${scope}:${key}...`);
    try {
      const res = await fetch("/api/reading/doctrine-draft", {
        method: "PUT",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ surface: "config", entityKey: ekey(scope, key), value, updatedBy: "ซินแส (online)" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `บันทึกร่างไม่สำเร็จ (${res.status})`);
      setStatus(`บันทึกร่าง ${scope}:${key} ✓ (ยังไม่เผยแพร่)`);
      await load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "บันทึกร่างไม่สำเร็จ");
    }
  };

  const publishItem = async (scope: Scope, key: string) => {
    setStatus(`กำลังเผยแพร่ ${scope}:${key}...`);
    try {
      const res = await fetch("/api/reading/doctrine-draft", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ surface: "config", entityKey: ekey(scope, key) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `เผยแพร่ไม่สำเร็จ (${res.status})`);
      setStatus(`เผยแพร่ ${scope}:${key} ✓`);
      await load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "เผยแพร่ไม่สำเร็จ");
    }
  };

  const discardDraft = async (scope: Scope, key: string) => {
    setStatus(`กำลังทิ้งร่าง ${scope}:${key}...`);
    try {
      const res = await fetch(`/api/reading/doctrine-draft?surface=config&key=${encodeURIComponent(ekey(scope, key))}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`ทิ้งร่างไม่สำเร็จ (${res.status})`);
      setStatus(`ทิ้งร่าง ${scope}:${key} ✓`);
      await load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "ทิ้งร่างไม่สำเร็จ");
    }
  };

  const publishAll = async () => {
    if (!window.confirm("เผยแพร่ร่างทั้งหมด (รวมบท/ขั้น/role/ดาว) ใช่หรือไม่?")) return;
    setStatus("กำลังเผยแพร่ทั้งหมด...");
    try {
      const res = await fetch("/api/reading/doctrine-draft", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ all: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `เผยแพร่ไม่สำเร็จ (${res.status})`);
      setStatus(`เผยแพร่ทั้งหมดสำเร็จ (${json.published} รายการ) ✓`);
      await load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "เผยแพร่ไม่สำเร็จ");
    }
  };

  const runPreview = async () => {
    setStatus("กำลังพรีวิวดวงตัวอย่าง (ใช้ฉบับร่าง)...");
    setPreview("");
    try {
      const res = await fetch("/api/reading/topic?preview=1", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ topicId: "chart_foundation", mode: "engine", rawInput: SAMPLE_BIRTH }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `พรีวิวไม่สำเร็จ (${res.status})`);
      setPreview((json.reading?.method ?? []).join("\n"));
      setStatus("พรีวิว (ดวง 24/11/2536) ด้วยฉบับร่าง ✓");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "พรีวิวไม่สำเร็จ");
    }
  };

  const hasDraft = (scope: Scope, key: string) => Boolean(drafts[ekey(scope, key)]);
  const hasPublished = (scope: Scope, key: string) => {
    if (!data) return false;
    const ovrKey = scope === "step" ? "steps" : scope === "role" ? "roles" : "stars";
    const ovr = data.overrides[ovrKey as keyof GetResponse["overrides"]] as Record<string, unknown>;
    return Boolean(ovr && key in ovr);
  };

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "Tahoma, sans-serif" }}>
      <h1 style={{ color: "#1F3864" }}>แก้นิยามขั้น / บทบาทธาตุ / ดาวพิเศษ (ร่าง → พรีวิว → เผยแพร่)</h1>
      <p style={{ color: "#555" }}>
        “บันทึกร่าง” = เก็บไว้ก่อน ยังไม่มีผลกับการอ่านจริง · “พรีวิว” = ดูผลกับดวงตัวอย่างโดยใช้ฉบับร่าง ·
        “เผยแพร่” = นำร่างขึ้นใช้จริง
      </p>
      <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
        <input placeholder="admin token" value={token} onChange={(e) => setToken(e.target.value)} style={{ ...inp, flex: 1, minWidth: 200 }} />
        <button onClick={() => void load()} style={btn}>โหลดใหม่</button>
        <button onClick={() => void runPreview()} style={{ ...btn, background: "#7030A0" }}>พรีวิวดวงตัวอย่าง</button>
        <button onClick={() => void publishAll()} style={{ ...btn, background: "#1E7D34" }}>เผยแพร่ทั้งหมด</button>
      </div>
      {status && <p style={{ color: "#7030A0" }}>{status}</p>}
      {preview && (
        <pre style={{ background: "#0b1021", color: "#d6e2ff", padding: 14, borderRadius: 8, whiteSpace: "pre-wrap", fontSize: 12 }}>{preview}</pre>
      )}

      {(["step", "role", "star"] as Scope[]).map((scope) => {
        if (!data) return null;
        const defs = data.defaults[scope] as Record<string, Record<string, string | number>>;
        const f = FIELDS[scope];
        return (
          <section key={scope} style={{ marginTop: 20 }}>
            <h2 style={{ color: "#1F3864" }}>{SCOPE_TITLE[scope]}</h2>
            {Object.keys(defs).map((key) => {
              const e = editing[ck(scope, key)];
              if (!e) return null;
              const draft = hasDraft(scope, key);
              return (
                <div key={key} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, margin: "8px 0", background: draft ? "#FFF8E1" : hasPublished(scope, key) ? "#EAF3FF" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <strong>
                      {key} {draft ? "· มีร่างค้าง" : hasPublished(scope, key) ? "· เผยแพร่แล้ว" : ""}
                    </strong>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => void saveDraft(scope, key)} style={btn}>บันทึกร่าง</button>
                      <button onClick={() => void publishItem(scope, key)} style={{ ...btn, background: "#1E7D34" }}>เผยแพร่</button>
                      {draft && <button onClick={() => void discardDraft(scope, key)} style={{ ...btn, background: "#aaa" }}>ทิ้งร่าง</button>}
                    </div>
                  </div>
                  <label style={lbl}>{f.aLabel}</label>
                  <input value={e.a} onChange={(ev) => setEdit(scope, key, { a: ev.target.value })} style={inp} />
                  <label style={lbl}>{f.bLabel}</label>
                  <textarea value={e.b} onChange={(ev) => setEdit(scope, key, { b: ev.target.value })} style={{ ...inp, minHeight: 54 }} />
                </div>
              );
            })}
          </section>
        );
      })}
    </main>
  );
}

const btn: React.CSSProperties = { padding: "6px 12px", background: "#1F3864", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const lbl: React.CSSProperties = { display: "block", fontSize: 12, color: "#333", marginTop: 8, marginBottom: 3 };
const inp: React.CSSProperties = { width: "100%", padding: 7, border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" };
