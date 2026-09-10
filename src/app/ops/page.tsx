"use client";

// หน้า Admin หลังบ้าน (engine) — /ops
// ใช้ง่าย: ใส่ secret ครั้งเดียว → ค้น/ดู user ทุกคน → แก้วัน-เวลาเกิด, เติม/หัก QI, เปลี่ยนแพ็กเกจ/สิทธิ์
// กด Save = ยิงเข้า DB ตรงผ่าน endpoint /api/ops/* และ /api/profile/admin, /api/qi/admin-adjust
// (ทุกอัน secret-gated ด้วย OPS_ADMIN_SECRET — หน้านี้ไม่มีข้อมูลจนกว่าจะใส่ secret ถูก).
import { useCallback, useEffect, useState } from "react";

type UserRow = {
  anonId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  gender: string | null;
  birthDate: string | null;
  birthTime: string | null;
  timeUnknown: boolean;
  birthProvince: string | null;
  qi: number;
  lineUserId?: string | null;
  hasProfile?: boolean;
  updatedAt: string;
};

type LedgerRow = { qiDelta: number; reason: string; ref: string | null; createdAt: string };
type QuotaLine = { unlimited?: boolean; freeLimit: number; usedToday: number; freeRemaining: number; credits: number };
type ChatStatus = { available?: boolean; tier?: string; chat?: QuotaLine; card?: Omit<QuotaLine, "unlimited">; matchingCredits?: number; note?: string };

type Entitlement = {
  kind: string;
  sku: string;
  credits: number;
  expiresAt: string | null;
  updatedAt: string;
};

type SubRow = { id: string; tier_code: string; package_code: string; amount_satang: number; start_at: string; expire_at: string; status: string; v2_payment_id: string | null; created_at: string };
type PayRow = { id: string; package_code: string; tier_code: string; amount_satang: number; vat_satang: number; method: string; status: string; created_at: string };
type SubData = { available: boolean; current: SubRow | null; history: SubRow[]; payments: PayRow[]; note?: string };

const KINDS = ["tier", "course", "book", "card_use", "chat_question", "matching_slot"] as const;
// ป้ายไทยให้คนอื่นอ่านง่าย (value ที่เขียน DB ยังเป็น key อังกฤษเหมือนเดิม)
const KIND_LABELS: Record<string, string> = {
  tier: "ระดับสมาชิก (tier)",
  course: "คอร์สเรียน",
  book: "หนังสือ / อีบุ๊ก",
  card_use: "สิทธิ์เปิดไพ่",
  chat_question: "สิทธิ์ถามแชท",
  matching_slot: "สิทธิ์ดูดวงคู่",
};
const kindLabel = (k: string) => KIND_LABELS[k] ?? k;
const baht = (satang: number) => (satang / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const C = {
  bg: "#0f1420",
  panel: "#171e2e",
  border: "#2a3446",
  text: "#e7ecf5",
  sub: "#93a1b8",
  accent: "#39a0c9",
  good: "#3fb27f",
  warn: "#d98a3a",
  danger: "#d1556a",
  inputBg: "#0d1220",
};

const box: React.CSSProperties = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: C.sub, marginBottom: 4 };
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: C.inputBg, border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.text, padding: "9px 11px", fontSize: 14, outline: "none",
};
function btn(bg: string): React.CSSProperties {
  return { background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
}

export default function OpsAdminPage() {
  const [secret, setSecret] = useState("");
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [sub, setSub] = useState<SubData | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [chatStatus, setChatStatus] = useState<ChatStatus | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("ops_secret") : "";
    if (saved) { setSecret(saved); setAdminName(window.localStorage.getItem("ops_name") ?? ""); setReady(true); }
  }, []);

  const note = (ok: boolean, msg: string) => { setFlash({ ok, msg }); window.clearTimeout((note as any)._t); (note as any)._t = window.setTimeout(() => setFlash(null), 4000); };

  const loadUsers = useCallback(async (query: string, pageArg: number) => {
    if (!secret) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/ops/users?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${pageArg * PAGE_SIZE}`, { headers: { "x-ops-secret": secret } });
      const j = await r.json();
      if (!r.ok) { note(false, j.error ?? "โหลดรายชื่อไม่สำเร็จ"); if (r.status === 401) setReady(false); return; }
      setUsers(j.users ?? []);
      setTotal(typeof j.total === "number" ? j.total : (j.users?.length ?? 0));
      setPage(pageArg);
    } catch { note(false, "เชื่อมต่อไม่ได้"); } finally { setBusy(false); }
  }, [secret]);

  const search = (query: string) => { void loadUsers(query, 0); };
  const goPage = (p: number) => { void loadUsers(q, p); };

  useEffect(() => { if (ready) void loadUsers("", 0); }, [ready, loadUsers]);

  const login = async () => {
    setLoginErr("");
    if (!username.trim() || !password) { setLoginErr("กรอก username และ password"); return; }
    try {
      const r = await fetch("/api/ops/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: username.trim(), password }) });
      const j = await r.json();
      if (!r.ok) { setLoginErr(j.error ?? "เข้าสู่ระบบไม่สำเร็จ"); return; }
      window.localStorage.setItem("ops_secret", j.secret);
      window.localStorage.setItem("ops_name", j.name ?? username.trim());
      setSecret(j.secret); setAdminName(j.name ?? username.trim()); setPassword(""); setReady(true);
    } catch { setLoginErr("เชื่อมต่อไม่ได้"); }
  };

  const loadEntitlements = useCallback(async (anonId: string) => {
    const r = await fetch(`/api/ops/entitlement?secret=${encodeURIComponent(secret)}&anonId=${encodeURIComponent(anonId)}`);
    const j = await r.json();
    if (r.ok) setEntitlements(j.entitlements ?? []); else setEntitlements([]);
  }, [secret]);

  const loadSub = useCallback(async (anonId: string) => {
    setSub(null);
    try {
      const r = await fetch(`/api/ops/subscription?secret=${encodeURIComponent(secret)}&anonId=${encodeURIComponent(anonId)}`);
      const j = await r.json();
      if (r.ok) setSub(j); else setSub({ available: false, current: null, history: [], payments: [], note: j.error });
    } catch { setSub({ available: false, current: null, history: [], payments: [], note: "โหลดไม่ได้" }); }
  }, [secret]);

  const loadLedger = useCallback(async (anonId: string) => {
    setLedger([]);
    try {
      const r = await fetch(`/api/ops/user-snapshot?anonId=${encodeURIComponent(anonId)}`, { headers: { "x-ops-secret": secret } });
      const j = await r.json();
      if (r.ok && Array.isArray(j.ledger)) setLedger(j.ledger);
    } catch { /* ignore */ }
  }, [secret]);

  const loadChatStatus = useCallback(async (anonId: string) => {
    setChatStatus(null);
    try {
      const r = await fetch(`/api/ops/chat-status?anonId=${encodeURIComponent(anonId)}`, { headers: { "x-ops-secret": secret } });
      const j = await r.json();
      if (r.ok) setChatStatus(j); else setChatStatus({ available: false, note: j.error });
    } catch { setChatStatus({ available: false, note: "โหลดไม่ได้" }); }
  }, [secret]);

  const select = async (u: UserRow) => { setSelected({ ...u }); setFlash(null); await Promise.all([loadEntitlements(u.anonId), loadSub(u.anonId), loadLedger(u.anonId), loadChatStatus(u.anonId)]); };

  const refreshSelectedFromList = async () => { if (selected) await loadUsers(q, page); };

  if (!ready) {
    return (
      <main style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ ...box, width: 360 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Admin หลังบ้าน · engine</h1>
          <p style={{ color: C.sub, fontSize: 13, margin: "0 0 14px" }}>เข้าสู่ระบบด้วยบัญชีของคุณ</p>
          <label style={label}>Username</label>
          <input style={input} value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} placeholder="username" autoComplete="username" />
          <label style={{ ...label, marginTop: 10 }}>Password</label>
          <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} placeholder="password" autoComplete="current-password" />
          {loginErr && <p style={{ color: C.danger, fontSize: 12, margin: "10px 0 0" }}>{loginErr}</p>}
          <button style={{ ...btn(C.accent), width: "100%", marginTop: 14 }} onClick={login}>เข้าสู่ระบบ</button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Admin หลังบ้าน · จัดการผู้ใช้</h1>
        <span style={{ color: C.sub, fontSize: 12 }}>เขียน DB ตรง</span>
        {adminName && <span style={{ color: C.accent, fontSize: 13 }}>· {adminName}</span>}
        <button style={{ ...btn(C.border), marginLeft: "auto", fontWeight: 500 }} onClick={() => { window.localStorage.removeItem("ops_secret"); window.localStorage.removeItem("ops_name"); setReady(false); setUsers([]); setSelected(null); }}>ออกจากระบบ</button>
      </div>

      {flash && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: flash.ok ? "#123528" : "#3a1620", color: flash.ok ? C.good : C.danger, border: `1px solid ${flash.ok ? C.good : C.danger}`, fontSize: 14 }}>{flash.msg}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 400px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        {/* ── รายชื่อ ── */}
        <div style={box}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input style={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search(q)} placeholder="ค้นชื่อ / อีเมล / anonId (เว้นว่าง = ทุกคน)" />
            <button style={btn(C.accent)} onClick={() => search(q)}>ค้นหา</button>
          </div>
          {(() => {
            const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
            const to = page * PAGE_SIZE + users.length;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: C.text }}>{busy ? "กำลังโหลด…" : <>ทั้งหมด <b>{total.toLocaleString()}</b> คน {q ? "(ตรงคำค้น)" : "ที่สมัคร"}</>}</span>
                <span style={{ fontSize: 12, color: C.sub }}>· แสดง {from}–{to}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                  <button style={{ ...btn(C.border), padding: "4px 10px", fontSize: 12, opacity: page <= 0 ? 0.4 : 1 }} disabled={page <= 0 || busy} onClick={() => goPage(page - 1)}>‹ ก่อนหน้า</button>
                  <span style={{ fontSize: 12, color: C.sub }}>{page + 1}/{pages}</span>
                  <button style={{ ...btn(C.border), padding: "4px 10px", fontSize: 12, opacity: page + 1 >= pages ? 0.4 : 1 }} disabled={page + 1 >= pages || busy} onClick={() => goPage(page + 1)}>ถัดไป ›</button>
                </span>
              </div>
            );
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "72vh", overflowY: "auto" }}>
            {users.map((u) => (
              <button key={u.anonId} onClick={() => select(u)} style={{ textAlign: "left", background: selected?.anonId === u.anonId ? "#1e2a40" : C.inputBg, border: `1px solid ${selected?.anonId === u.anonId ? C.accent : C.border}`, borderRadius: 8, padding: "9px 11px", color: C.text, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "(ไม่มีชื่อ)"}</span>
                  {u.hasProfile === false && <span style={{ fontSize: 9, color: C.warn, border: `1px solid ${C.warn}`, borderRadius: 6, padding: "1px 5px" }}>ยังไม่ตั้งชื่อ</span>}
                </div>
                <div style={{ fontSize: 12, color: C.sub }}>เกิด {u.birthDate ?? "—"}{u.timeUnknown ? " · ไม่ทราบเวลา" : u.birthTime ? ` ${u.birthTime}` : ""} · {u.gender ?? "—"} · QI {u.qi}</div>
                {u.email && <div style={{ fontSize: 11, color: C.sub }}>{u.email}</div>}
                <div style={{ fontSize: 10, color: C.sub, opacity: 0.7 }}>{u.anonId}{u.lineUserId ? ` · LINE ${u.lineUserId}` : ""}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── รายละเอียด/แก้ไข ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!selected ? (
            <div style={{ ...box, color: C.sub }}>เลือกผู้ใช้จากรายชื่อทางซ้ายเพื่อแก้ไข</div>
          ) : (
            <>
              <ProfileCard user={selected} setUser={setSelected} secret={secret} onSaved={(m) => { note(true, m); void refreshSelectedFromList(); }} onError={(m) => note(false, m)} />
              <PackageCard anonId={selected.anonId} secret={secret} sub={sub} reload={() => loadSub(selected.anonId)} onSaved={(m) => note(true, m)} onError={(m) => note(false, m)} />
              <QiCard user={selected} secret={secret} ledger={ledger} reloadLedger={() => loadLedger(selected.anonId)} onSaved={(qi, m) => { setSelected((s) => (s ? { ...s, qi } : s)); note(true, m); void refreshSelectedFromList(); }} onError={(m) => note(false, m)} />
              <ChatQuotaCard anonId={selected.anonId} secret={secret} status={chatStatus} ledger={ledger} reload={() => { void loadChatStatus(selected.anonId); void loadEntitlements(selected.anonId); }} onSaved={(m) => note(true, m)} onError={(m) => note(false, m)} />
              <EntitlementCard anonId={selected.anonId} secret={secret} entitlements={entitlements} reload={() => loadEntitlements(selected.anonId)} onSaved={(m) => note(true, m)} onError={(m) => note(false, m)} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function ProfileCard({ user, setUser, secret, onSaved, onError }: { user: UserRow; setUser: (u: UserRow) => void; secret: string; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<UserRow>) => setUser({ ...user, ...patch });
  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/profile/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          anonId: user.anonId,
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          gender: user.gender || null,
          birthProvince: user.birthProvince || null,
          birth: user.birthDate || undefined,
          birthTime: user.timeUnknown ? null : user.birthTime || null,
          timeUnknown: user.timeUnknown,
        }),
      });
      const j = await r.json();
      if (!r.ok) return onError(j.error ?? "บันทึกโปรไฟล์ไม่สำเร็จ");
      if (!j.updated && !j.legacySynced) return onError("ไม่พบผู้ใช้/ไม่มีแถวให้แก้");
      onSaved(j.updated ? "บันทึกวัน-เวลาเกิด/โปรไฟล์แล้ว" : "บันทึกวันเกิด (legacy) แล้ว — ผู้ใช้ยังไม่ตั้ง @name");
    } catch { onError("เชื่อมต่อไม่ได้"); } finally { setSaving(false); }
  };
  return (
    <div style={box}>
      <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>โปรไฟล์ · วัน-เวลาเกิด</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={label}>ชื่อ</label><input style={input} value={user.firstName ?? ""} onChange={(e) => set({ firstName: e.target.value })} /></div>
        <div><label style={label}>นามสกุล</label><input style={input} value={user.lastName ?? ""} onChange={(e) => set({ lastName: e.target.value })} /></div>
        <div><label style={label}>วันเกิด (YYYY-MM-DD)</label><input style={input} value={user.birthDate ?? ""} onChange={(e) => set({ birthDate: e.target.value })} placeholder="1990-01-31" /></div>
        <div><label style={label}>เวลาเกิด (HH:mm)</label><input style={input} value={user.birthTime ?? ""} onChange={(e) => set({ birthTime: e.target.value })} placeholder="08:30" disabled={user.timeUnknown} /></div>
        <div><label style={label}>เพศ</label>
          <select style={input} value={user.gender ?? ""} onChange={(e) => set({ gender: e.target.value || null })}>
            <option value="">—</option><option value="MALE">MALE</option><option value="FEMALE">FEMALE</option><option value="OTHER">OTHER</option>
          </select>
        </div>
        <div><label style={label}>จังหวัดที่เกิด</label><input style={input} value={user.birthProvince ?? ""} onChange={(e) => set({ birthProvince: e.target.value })} /></div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 14, color: C.text }}>
        <input type="checkbox" checked={user.timeUnknown} onChange={(e) => set({ timeUnknown: e.target.checked })} /> ไม่ทราบเวลา (คำนวณแบบหยาบ)
      </label>
      <button style={{ ...btn(C.good), marginTop: 14 }} onClick={save} disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกโปรไฟล์ → DB"}</button>
    </div>
  );
}

function qiSource(reason: string): { label: string; admin: boolean } {
  if (reason.startsWith("qi:ops:")) return { label: "แอดมินปรับ", admin: true };
  if (/purchase|buy|topup|payment|pay/i.test(reason)) return { label: "ผู้ใช้เติมเอง", admin: false };
  return { label: reason.replace(/^qi:/, ""), admin: false };
}

function QiCard({ user, secret, ledger, reloadLedger, onSaved, onError }: { user: UserRow; secret: string; ledger: LedgerRow[]; reloadLedger: () => void; onSaved: (qi: number, m: string) => void; onError: (m: string) => void }) {
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const apply = async () => {
    const n = Number(delta);
    if (!Number.isInteger(n) || n === 0) return onError("ใส่จำนวน QI (จำนวนเต็ม ≠ 0) — บวก=เติม ลบ=หัก");
    setSaving(true);
    try {
      const r = await fetch("/api/qi/admin-adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, anonId: user.anonId, qiDelta: n, note: note || undefined, ref: `ops-${Date.now()}` }),
      });
      const j = await r.json();
      if (!r.ok) return onError(j.error ?? "ปรับ QI ไม่สำเร็จ");
      setDelta(""); setNote("");
      onSaved(j.qi ?? user.qi, `ปรับ QI แล้ว (คงเหลือ ${j.qi})`);
      reloadLedger();
    } catch { onError("เชื่อมต่อไม่ได้"); } finally { setSaving(false); }
  };
  return (
    <div style={box}>
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>QI</h2>
      <p style={{ color: C.sub, fontSize: 13, margin: "0 0 12px" }}>ยอดปัจจุบัน <b style={{ color: C.text }}>{user.qi}</b></p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
        <div style={{ width: 140 }}><label style={label}>จำนวน (± )</label><input style={input} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="เช่น 150 หรือ -50" /></div>
        <div style={{ flex: "1 1 160px", minWidth: 0 }}><label style={label}>หมายเหตุ (optional)</label><input style={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เหตุผล" /></div>
        <button style={btn(C.good)} onClick={apply} disabled={saving}>{saving ? "…" : "ปรับ QI → DB"}</button>
      </div>

      {ledger.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>ประวัติ QI ({ledger.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
            {ledger.map((l, i) => {
              const src = qiSource(l.reason);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 11px", fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: l.qiDelta >= 0 ? C.good : C.danger, width: 56 }}>{l.qiDelta >= 0 ? `+${l.qiDelta}` : l.qiDelta}</span>
                  <span style={{ fontSize: 10, color: src.admin ? C.warn : C.accent, border: `1px solid ${src.admin ? C.warn : C.accent}`, borderRadius: 6, padding: "1px 6px" }}>{src.label}</span>
                  <span style={{ color: C.sub, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.reason}</span>
                  <span style={{ marginLeft: "auto", color: C.sub }}>{String(l.createdAt).slice(0, 10)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatQuotaCard({ anonId, secret, status, ledger, reload, onSaved, onError }: { anonId: string; secret: string; status: ChatStatus | null; ledger: LedgerRow[]; reload: () => void; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const [credits, setCredits] = useState("");
  const [saving, setSaving] = useState(false);

  const setChatCredits = async (value: number) => {
    setSaving(true);
    try {
      const r = await fetch("/api/ops/entitlement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, anonId, kind: "chat_question", sku: "", credits: value }) });
      const j = await r.json();
      if (!r.ok) return onError(j.error ?? "ตั้งเครดิตแชทไม่สำเร็จ");
      onSaved(value === 0 ? "ตัดเครดิตแชทเป็น 0 แล้ว" : `ตั้งเครดิตแชท = ${value} แล้ว`);
      setCredits("");
      reload();
    } catch { onError("เชื่อมต่อไม่ได้"); } finally { setSaving(false); }
  };

  // ประวัติที่ระบบเก็บได้: การแชทที่ตกไปหัก QI (reason qi:spend:chat_question) — โผล่ใน ledger เดียวกับ QI
  const chatLedger = ledger.filter((l) => /chat_question|chat/i.test(l.reason));
  const chat = status?.chat;

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>แชท AI · โควตา</h2>
        {status?.tier && <TierBadge tier={String(status.tier).toUpperCase()} />}
      </div>
      <p style={{ color: C.sub, fontSize: 12, margin: "0 0 12px" }}>ลำดับการใช้: ฟรีรายวัน (ตามระดับสมาชิก) → เครดิตแชทที่แลก/ซื้อ → หัก QI</p>

      {!status ? (
        <p style={{ color: C.sub, fontSize: 13 }}>กำลังโหลด…</p>
      ) : status.available === false ? (
        <p style={{ color: C.warn, fontSize: 13 }}>{status.note ?? "ดูโควตาไม่ได้บนเครื่องนี้ (ใช้ได้บน prod)"}</p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            {chat?.unlimited ? (
              <Stat label="แชทวันนี้" value="ไม่จำกัด" hint={`สมาชิก ${status.tier} — ใช้ฟรีไม่อั้น`} good />
            ) : (
              <Stat label="แชทฟรีวันนี้" value={`${chat?.usedToday ?? 0}/${chat?.freeLimit ?? 0}`} hint={`เหลือวันนี้ ${chat?.freeRemaining ?? 0}`} />
            )}
            <Stat label="เครดิตแชทเพิ่ม" value={String(chat?.credits ?? 0)} hint="ใช้ต่อเมื่อฟรีหมด (แลก/ซื้อ/แอดมินให้)" warn={(chat?.credits ?? 0) > 0 && !chat?.unlimited} />
          </div>

          {chat?.unlimited && (
            <p style={{ color: C.warn, fontSize: 12, margin: "0 0 12px" }}>⚠️ ระดับสมาชิก {status.tier} = แชทไม่จำกัด ไม่ว่าเครดิตเท่าไร ถ้าจะจำกัดแชทต้องปรับแพ็กเกจเป็น FREE ด้านบนก่อน แล้วค่อยตั้งเครดิตแชท</p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
            <div style={{ width: 160 }}><label style={label}>ตั้งเครดิตแชท (ตายตัว)</label><input style={input} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="เช่น 50" /></div>
            <button style={btn(C.good)} disabled={saving || credits.trim() === "" || !Number.isInteger(Number(credits))} onClick={() => setChatCredits(Math.max(0, Math.trunc(Number(credits))))}>{saving ? "…" : "ตั้งเครดิต → DB"}</button>
            <button style={btn(C.danger)} disabled={saving} onClick={() => setChatCredits(0)}>ตัดแชท (ตั้ง 0)</button>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: C.sub }}>
            ประวัติแชทที่หัก QI (ครั้งที่ฟรี+เครดิตหมดแล้วจ่ายด้วย QI) — {chatLedger.length} รายการ
            {chatLedger.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {chatLedger.slice(0, 10).map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 11px" }}>
                    <span style={{ color: C.danger, fontWeight: 700, width: 56 }}>{l.qiDelta}</span>
                    <span style={{ color: C.sub }}>{l.reason}</span>
                    <span style={{ marginLeft: "auto", color: C.sub }}>{String(l.createdAt).slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 6, opacity: 0.8 }}>หมายเหตุ: การแชทที่ใช้โควตาฟรีรายวันหรือเครดิต ระบบนับเป็นตัวเลข (ใช้วันนี้/เครดิตคงเหลือด้านบน) ไม่ได้ log รายครั้งแยกเหมือน QI</div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, good, warn }: { label: string; value: string; hint?: string; good?: boolean; warn?: boolean }) {
  const color = good ? C.good : warn ? C.warn : C.text;
  return (
    <div style={{ background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", minWidth: 130 }}>
      <div style={{ fontSize: 11, color: C.sub }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function addDays(fromIso: string, days: number): string {
  const d = new Date(`${fromIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const TODAY = () => new Date().toISOString().slice(0, 10);

function TierBadge({ tier }: { tier: string }) {
  const color = tier === "PRO" ? "#b07de8" : tier === "PLUS" ? C.accent : C.sub;
  return <span style={{ fontSize: 11, fontWeight: 700, color, border: `1px solid ${color}`, borderRadius: 6, padding: "1px 7px" }}>{tier}</span>;
}

function PackageCard({ anonId, secret, sub, reload, onSaved, onError }: { anonId: string; secret: string; sub: SubData | null; reload: () => void; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const [tier, setTier] = useState<"FREE" | "PLUS" | "PRO">("PLUS");
  const [startAt, setStartAt] = useState(TODAY());
  const [expireAt, setExpireAt] = useState(addDays(TODAY(), 30));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/ops/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, anonId, tierCode: tier, startAt, expireAt }) });
      const j = await r.json();
      if (!r.ok) return onError(j.error ?? "บันทึกแพ็กเกจไม่สำเร็จ");
      onSaved(tier === "FREE" ? "เพิกถอนแพ็กเกจแล้ว (เป็น FREE)" : `ให้แพ็กเกจ ${tier} ถึง ${expireAt} แล้ว`);
      reload();
    } catch { onError("เชื่อมต่อไม่ได้"); } finally { setSaving(false); }
  };

  const cur = sub?.current;
  const tierBtn = (t: "FREE" | "PLUS" | "PRO") => (
    <button key={t} onClick={() => setTier(t)} style={{ ...btn(tier === t ? (t === "PRO" ? "#7d4bb0" : t === "PLUS" ? C.accent : "#555f73") : C.inputBg), border: `1px solid ${tier === t ? "transparent" : C.border}`, fontWeight: 700, minWidth: 74 }}>{t}</button>
  );

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>แพ็กเกจ (สมาชิก)</h2>
        {sub && (cur ? <span style={{ fontSize: 13, color: C.sub, display: "flex", gap: 6, alignItems: "center" }}>ปัจจุบัน <TierBadge tier={String(cur.tier_code)} /> ถึง {String(cur.expire_at)}</span> : <span style={{ fontSize: 13, color: C.sub }}>ปัจจุบัน <TierBadge tier="FREE" /></span>)}
      </div>

      {sub && !sub.available ? (
        <p style={{ color: C.warn, fontSize: 13, margin: 0 }}>{sub.note ?? "ตาราง subscription ไม่พร้อมบนเครื่องนี้ (ใช้ได้บน prod)"}</p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
            <div><label style={label}>เลือกแพ็กเกจ</label><div style={{ display: "flex", gap: 6 }}>{(["FREE", "PLUS", "PRO"] as const).map(tierBtn)}</div></div>
            <div style={{ width: 150 }}><label style={label}>ตั้งแต่</label><input style={input} value={startAt} onChange={(e) => setStartAt(e.target.value)} placeholder="YYYY-MM-DD" disabled={tier === "FREE"} /></div>
            <div style={{ width: 150 }}><label style={label}>ถึง</label><input style={input} value={expireAt} onChange={(e) => setExpireAt(e.target.value)} placeholder="YYYY-MM-DD" disabled={tier === "FREE"} /></div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ ...btn(C.border), fontWeight: 500, opacity: tier === "FREE" ? 0.4 : 1 }} disabled={tier === "FREE"} onClick={() => setExpireAt(addDays(startAt, 30))}>+1 เดือน</button>
              <button style={{ ...btn(C.border), fontWeight: 500, opacity: tier === "FREE" ? 0.4 : 1 }} disabled={tier === "FREE"} onClick={() => setExpireAt(addDays(startAt, 365))}>+1 ปี</button>
            </div>
            <button style={btn(C.good)} onClick={save} disabled={saving}>{saving ? "…" : "บันทึกแพ็กเกจ → DB"}</button>
          </div>

          {sub && (sub.history.length > 0 || sub.payments.length > 0) && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
              {sub.history.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>ประวัติแพ็กเกจ</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {sub.history.map((h) => (
                      <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 12, flexWrap: "wrap" }}>
                        <TierBadge tier={String(h.tier_code)} />
                        <span style={{ color: C.sub }}>{h.package_code}</span>
                        <span>{String(h.start_at)} → {String(h.expire_at)}</span>
                        <span style={{ color: h.status === "ACTIVE" ? C.good : C.sub }}>{h.status}</span>
                        <span style={{ marginLeft: "auto", color: C.sub }}>{h.amount_satang ? `฿${baht(h.amount_satang)}` : "แอดมินให้"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {sub.payments.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>ประวัติการจ่ายเงิน</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {sub.payments.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 12, flexWrap: "wrap" }}>
                        <span>{String(p.created_at).slice(0, 10)}</span>
                        <TierBadge tier={String(p.tier_code)} />
                        <span style={{ color: C.sub }}>{p.package_code} · {p.method}</span>
                        <span style={{ color: p.status === "SUCCESSFUL" || p.status === "successful" ? C.good : p.status === "FAILED" || p.status === "failed" ? C.danger : C.warn }}>{p.status}</span>
                        <span style={{ marginLeft: "auto", fontWeight: 700 }}>฿{baht(p.amount_satang + (p.vat_satang ?? 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EntitlementCard({ anonId, secret, entitlements, reload, onSaved, onError }: { anonId: string; secret: string; entitlements: Entitlement[]; reload: () => void; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const [kind, setKind] = useState<string>("tier");
  const [sku, setSku] = useState("plus");
  const [credits, setCredits] = useState("");
  const [expiresAt, setExpiresAt] = useState(""); // YYYY-MM-DD (optional)
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { secret, anonId, kind, sku };
      if (credits.trim() !== "") body.credits = Number(credits);
      if (expiresAt.trim() !== "") body.expiresAt = new Date(`${expiresAt}T00:00:00Z`).toISOString();
      const r = await fetch("/api/ops/entitlement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) return onError(j.error ?? "บันทึกสิทธิ์ไม่สำเร็จ");
      onSaved(`ให้/อัปเดตสิทธิ์ ${kindLabel(kind)}${sku ? ` · ${sku}` : ""} แล้ว`);
      reload();
    } catch { onError("เชื่อมต่อไม่ได้"); } finally { setSaving(false); }
  };

  const remove = async (e: Entitlement) => {
    try {
      const r = await fetch("/api/ops/entitlement", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, anonId, kind: e.kind, sku: e.sku }) });
      const j = await r.json();
      if (!r.ok) return onError(j.error ?? "ถอนสิทธิ์ไม่สำเร็จ");
      onSaved(`ถอนสิทธิ์ ${kindLabel(e.kind)}${e.sku ? ` · ${e.sku}` : ""} แล้ว`);
      reload();
    } catch { onError("เชื่อมต่อไม่ได้"); }
  };

  return (
    <div style={box}>
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>สิทธิ์การใช้งานเพิ่มเติม</h2>
      <p style={{ color: C.sub, fontSize: 12, margin: "0 0 12px" }}>ให้เครดิต/โควตาเฉพาะอย่าง (เปิดไพ่ · ถามแชท · ดูดวงคู่ · คอร์ส · หนังสือ) — คนละส่วนกับแพ็กเกจสมาชิกด้านบน</p>
      {entitlements.length === 0 ? (
        <p style={{ color: C.sub, fontSize: 13, margin: "0 0 12px" }}>ยังไม่มีสิทธิ์</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {entitlements.map((e) => (
            <div key={`${e.kind}:${e.sku}`} style={{ display: "flex", alignItems: "center", gap: 10, background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{kindLabel(e.kind)}{e.sku ? ` · ${e.sku}` : ""}</span>
              <span style={{ color: C.sub }}>เครดิต {e.credits}</span>
              <span style={{ color: C.sub }}>{e.expiresAt ? `หมดอายุ ${e.expiresAt.slice(0, 10)}` : "ไม่หมดอายุ"}</span>
              <button style={{ ...btn(C.danger), marginLeft: "auto", padding: "5px 10px", fontSize: 12 }} onClick={() => remove(e)}>ถอน</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
        <div style={{ flex: "1 1 160px", minWidth: 0 }}><label style={label}>ประเภทสิทธิ์</label>
          <select style={input} value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}</select>
        </div>
        <div style={{ flex: "1 1 130px", minWidth: 0 }}><label style={label}>รหัสรุ่น (ถ้ามี)</label><input style={input} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="เช่น plus / destiny" /></div>
        <div style={{ width: 110 }}><label style={label}>จำนวนเครดิต</label><input style={input} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="0" /></div>
        <div style={{ width: 150 }}><label style={label}>วันหมดอายุ (ถ้ามี)</label><input style={input} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} placeholder="2026-12-31" /></div>
        <button style={btn(C.good)} onClick={save} disabled={saving}>{saving ? "…" : "ให้สิทธิ์ → DB"}</button>
      </div>
    </div>
  );
}
