"use client";

import { useCallback, useEffect, useState } from "react";

type AuditRow = {
  id: string;
  surface: string;
  entityKey: string;
  action: string;
  value: Record<string, unknown> | null;
  actor: string | null;
  createdAt: string;
};

export default function DoctrineAuditPage() {
  const [token, setToken] = useState("");
  const [surface, setSurface] = useState("");
  const [key, setKey] = useState("");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [status, setStatus] = useState("");

  const authHeaders = useCallback(
    (): HeadersInit => (token.trim() ? { "x-admin-token": token.trim() } : {}),
    [token],
  );

  const load = useCallback(async () => {
    setStatus("");
    const params = new URLSearchParams();
    if (surface) params.set("surface", surface);
    if (key.trim()) params.set("key", key.trim());
    try {
      const res = await fetch(`/api/reading/doctrine-audit?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`โหลดไม่สำเร็จ (${res.status})`);
      const json = (await res.json()) as { rows: AuditRow[] };
      setRows(json.rows);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    }
  }, [authHeaders, surface, key]);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = async (id: string) => {
    if (!window.confirm("ยืนยัน restore ค่านี้กลับมาใช้?")) return;
    setStatus("กำลัง restore...");
    try {
      const res = await fetch("/api/reading/doctrine-audit", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id, actor: "ซินแส (online)" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `restore ไม่สำเร็จ (${res.status})`);
      setStatus("restore สำเร็จ ✓");
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "restore ไม่สำเร็จ");
    }
  };

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: 24, fontFamily: "Tahoma, sans-serif" }}>
      <h1 style={{ color: "#1F3864" }}>ประวัติการแก้ doctrine + ย้อนกลับ (Audit)</h1>
      <p style={{ color: "#555" }}>ทุกการแก้ (lens/ขั้น/role/ดาว) ถูกบันทึกที่นี่ กด “ย้อนกลับ” เพื่อนำค่านั้นกลับมาใช้</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <input placeholder="admin token" value={token} onChange={(e) => setToken(e.target.value)} style={{ ...inp, flex: 1, minWidth: 200 }} />
        <select value={surface} onChange={(e) => setSurface(e.target.value)} style={{ ...inp, width: 160 }}>
          <option value="">ทุก surface</option>
          <option value="topic">topic (รายบท)</option>
          <option value="config">config (ขั้น/role/ดาว)</option>
        </select>
        <input placeholder="key (เช่น wealth_and_investment หรือ step:balance-core)" value={key} onChange={(e) => setKey(e.target.value)} style={{ ...inp, width: 320 }} />
        <button onClick={() => void load()} style={btn}>ค้นหา</button>
      </div>
      {status && <p style={{ color: "#7030A0" }}>{status}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#1F3864", color: "#fff" }}>
            <th style={th}>เวลา</th>
            <th style={th}>ผู้แก้</th>
            <th style={th}>surface</th>
            <th style={th}>key</th>
            <th style={th}>action</th>
            <th style={th}>value</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={td}>{new Date(r.createdAt).toLocaleString("th-TH")}</td>
              <td style={td}>{r.actor ?? "—"}</td>
              <td style={td}>{r.surface}</td>
              <td style={td}>{r.entityKey}</td>
              <td style={td}>{r.action}</td>
              <td style={{ ...td, maxWidth: 360, wordBreak: "break-word", color: "#444" }}>
                {r.value ? JSON.stringify(r.value) : "—"}
              </td>
              <td style={td}>
                <button onClick={() => void restore(r.id)} style={{ ...btn, padding: "4px 10px" }}>ย้อนกลับ</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td style={td} colSpan={7}>— ยังไม่มีประวัติ —</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

const btn: React.CSSProperties = { padding: "6px 12px", background: "#1F3864", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const inp: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" };
const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left" };
const td: React.CSSProperties = { padding: "6px 10px", verticalAlign: "top" };
