"use client";

// หน้า Admin หลังบ้าน (engine) — /ops
// ใช้ง่าย: ใส่ secret ครั้งเดียว → ค้น/ดู user ทุกคน → แก้วัน-เวลาเกิด, เติม/หัก QI, เปลี่ยนแพ็กเกจ/สิทธิ์
// กด Save = ยิงเข้า DB ตรงผ่าน endpoint /api/ops/* และ /api/profile/admin, /api/qi/admin-adjust
// (ทุกอัน secret-gated ด้วย OPS_ADMIN_SECRET — หน้านี้ไม่มีข้อมูลจนกว่าจะใส่ secret ถูก).
import { Fragment, useCallback, useEffect, useState } from "react";

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
  handle?: string | null; // @name จริง (raw) สำหรับแก้ไข
  provider?: string | null; // 'LINE' | 'GOOGLE' | null
  providerName?: string | null; // ชื่อจาก provider ตอน login
  lineId?: string | null; // LINE userId (เฉพาะ provider LINE)
  hasProfile?: boolean;
  updatedAt: string;
};

type LedgerRow = { qiDelta: number; reason: string; ref: string | null; createdAt: string };
type QuotaLine = { unlimited?: boolean; freeLimit: number; usedToday: number; freeRemaining: number; credits: number };
type ChatStatus = { available?: boolean; tier?: string; chat?: QuotaLine; card?: QuotaLine; matchingCredits?: number; unlimited?: Record<string, boolean>; note?: string };

// ฟีเจอร์ที่จัดการสิทธิ์/โควตาได้ในการ์ดเดียว (dropdown). credit=true → มีคลังเครดิต (ตั้งจำนวนได้);
// credit=false → หัก QI ตรง ๆ ต่อครั้ง (ตั้งได้แค่ "ไม่จำกัด/ไม่หัก QI"). qi = ราคาต่อครั้งตาม catalog.
type FeatureDef = { code: string; label: string; credit: boolean; qi: number; note: string };
const FEATURES: FeatureDef[] = [
  { code: "card_use", label: "เปิดไพ่ / เสี่ยงทาย", credit: true, qi: 10, note: "เปลี่ยนชื่อ/เปลี่ยนวันที่ดูดวงไพ่ = เปิดไพ่ 1 ครั้ง (divine/oracle/fortune-sage)" },
  { code: "chat_question", label: "ถามแชท AI", credit: true, qi: 30, note: "PLUS/PRO แชทไม่จำกัดอยู่แล้ว (ตาม tier)" },
  { code: "phone_reading", label: "ดูเบอร์ (ทำนายเบอร์มือถือ)", credit: true, qi: 10, note: "เลขศาสตร์ + คำทำนาย AI — grant เครดิตแล้วดูฟรีก่อนหัก QI" },
  { code: "honeycomb_reading", label: "ทำนายเบอร์รังผึ้ง", credit: true, qi: 10, note: "พีระมิดผลรวมคู่เลข + คำทำนาย AI — grant เครดิตแล้วดูฟรีก่อนหัก QI" },
  { code: "birth_edit", label: "เปลี่ยนวันเกิด", credit: false, qi: 150, note: "ฟรีครั้งแรกตลอดชีพ แล้วครั้งถัดไป 150 QI (เปลี่ยน @name ฟรีอยู่แล้ว ไม่หัก QI)" },
  { code: "matching_slot", label: "ช่องดูดวงคู่ (สมพงษ์)", credit: true, qi: 150, note: "เพิ่มช่องบันทึกดวงคู่ถาวร" },
  { code: "streak_restore", label: "กู้คืนสตรีคเช็คอิน", credit: false, qi: 20, note: "ต่อสตรีคที่ขาด 1 วัน (ปกติจำกัดสัปดาห์ละ 1 ครั้ง)" },
];

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

const KINDS = ["tier", "course", "book", "calendar", "card_use", "chat_question", "matching_slot"] as const;
// ป้ายไทยให้คนอื่นอ่านง่าย (value ที่เขียน DB ยังเป็น key อังกฤษเหมือนเดิม)
const KIND_LABELS: Record<string, string> = {
  tier: "ระดับสมาชิก (tier)",
  course: "คอร์สเรียน",
  book: "หนังสือ / อีบุ๊ก",
  calendar: "ปฏิทินดวงเฉพาะบุคคล",
  card_use: "สิทธิ์เปิดไพ่",
  chat_question: "สิทธิ์ถามแชท",
  matching_slot: "สิทธิ์ดูดวงคู่",
  unlimited: "ไม่จำกัด (ไม่หัก QI)",
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

// เอ็ม 2026-09-20: ให้ /ops ใช้บนมือถือได้ — hook เช็คจอแคบ (matchMedia) เพื่อสลับ layout เป็น 1 คอลัมน์.
// inline style ชนะ CSS media query (specificity) จึงต้องคำนวณค่าใน JS แทน @media.
function useIsMobile(breakpoint = 760): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [breakpoint]);
  return isMobile;
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
  const [providerFilter, setProviderFilter] = useState(""); // '' | 'LINE' | 'GOOGLE'
  const isMobile = useIsMobile();

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("ops_secret") : "";
    if (saved) { setSecret(saved); setAdminName(window.localStorage.getItem("ops_name") ?? ""); setReady(true); }
  }, []);

  const note = (ok: boolean, msg: string) => { setFlash({ ok, msg }); window.clearTimeout((note as any)._t); (note as any)._t = window.setTimeout(() => setFlash(null), 4000); };

  const loadUsers = useCallback(async (query: string, pageArg: number, prov: string) => {
    if (!secret) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/ops/users?q=${encodeURIComponent(query)}&provider=${encodeURIComponent(prov)}&limit=${PAGE_SIZE}&offset=${pageArg * PAGE_SIZE}`, { headers: { "x-ops-secret": secret } });
      const j = await r.json();
      if (!r.ok) { note(false, j.error ?? "โหลดรายชื่อไม่สำเร็จ"); if (r.status === 401) setReady(false); return; }
      setUsers(j.users ?? []);
      setTotal(typeof j.total === "number" ? j.total : (j.users?.length ?? 0));
      setPage(pageArg);
    } catch { note(false, "เชื่อมต่อไม่ได้"); } finally { setBusy(false); }
  }, [secret]);

  const search = (query: string) => { void loadUsers(query, 0, providerFilter); }; // ทันที (ปุ่ม/Enter)
  const goPage = (p: number) => { void loadUsers(q, p, providerFilter); };
  const changeProvider = (prov: string) => { setProviderFilter(prov); }; // effect ด้านล่าง reload ให้

  // ค้นหาแบบ live: พิมพ์/เปลี่ยน provider แล้วค้นเองหลัง 250ms (เอ็ม 2026-09-20 "กดค้นหาให้ไวๆ") — ไม่ต้องกดปุ่ม.
  // effect นี้เป็น trigger เดียวสำหรับ q/provider (รวมโหลดครั้งแรกตอน ready) → ไม่ยิงซ้ำ. pagination แยก (goPage).
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => { void loadUsers(q, 0, providerFilter); }, 250);
    return () => window.clearTimeout(t);
  }, [q, providerFilter, ready, loadUsers]);

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

  // เปิด detail ของ user จาก anonId (ใช้เมื่อกดจากตารางภาพรวม) — ดึงแถวเต็มมาก่อนเพื่อให้แก้ไขได้ครบ
  const openUserById = async (anonId: string) => {
    let row: UserRow | null = null;
    try {
      const r = await fetch(`/api/ops/users?q=${encodeURIComponent(anonId)}&limit=5`, { headers: { "x-ops-secret": secret } });
      const j = await r.json();
      const list: UserRow[] = j.users ?? [];
      row = list.find((u) => u.anonId === anonId) ?? list[0] ?? null;
    } catch { /* fallback ด้านล่าง */ }
    await select(row ?? ({ anonId, qi: 0 } as UserRow));
    if (typeof document !== "undefined") document.getElementById("ops-user-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const refreshSelectedFromList = async () => { if (selected) await loadUsers(q, page, providerFilter); };

  if (!ready) {
    return (
      <main style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ ...box, width: "min(360px, 92vw)", boxSizing: "border-box" }}>
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
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif", padding: isMobile ? 12 : 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: isMobile ? 17 : 20, margin: 0 }}>Admin หลังบ้าน · จัดการผู้ใช้</h1>
        <span style={{ color: C.sub, fontSize: 12 }}>เขียน DB ตรง</span>
        {adminName && <span style={{ color: C.accent, fontSize: 13 }}>· {adminName}</span>}
        <button style={{ ...btn(C.border), marginLeft: "auto", fontWeight: 500 }} onClick={() => { window.localStorage.removeItem("ops_secret"); window.localStorage.removeItem("ops_name"); setReady(false); setUsers([]); setSelected(null); }}>ออกจากระบบ</button>
      </div>

      {flash && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: flash.ok ? "#123528" : "#3a1620", color: flash.ok ? C.good : C.danger, border: `1px solid ${flash.ok ? C.good : C.danger}`, fontSize: 14 }}>{flash.msg}</div>
      )}

      {/* ภาพรวมรายวัน (DAU / ใช้อะไร / รายรับ / ถามอะไร) */}
      <AnalyticsPanel secret={secret} onOpenUser={openUserById} />

      {/* หากลุ่มลูกค้า (ปุ่ม PLUS / PRO / QI>500) → กดแถวเปิด detail/แก้ไข */}
      <SegmentPanel secret={secret} onOpenUser={openUserById} />

      {/* คูปองกิจกรรม (global — ไม่ผูก user) */}
      <CouponManager secret={secret} onNote={note} />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(300px, 400px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        {/* ── รายชื่อ ── */}
        <div style={box}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input style={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search(q)} placeholder="ค้น ชื่อไลน์ / @name / ชื่อจริง / อีเมล / LINE id / anonId" />
            <button style={btn(C.accent)} onClick={() => search(q)}>ค้นหา</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[{ v: "", l: "ทุก provider" }, { v: "LINE", l: "LINE" }, { v: "GOOGLE", l: "Google" }].map((o) => (
              <button key={o.v} onClick={() => changeProvider(o.v)} style={{ ...btn(providerFilter === o.v ? C.accent : C.inputBg), border: `1px solid ${providerFilter === o.v ? "transparent" : C.border}`, fontSize: 12, fontWeight: 600, padding: "5px 12px" }}>{o.l}</button>
            ))}
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
                  <button style={{ ...btn(C.border), padding: isMobile ? "8px 14px" : "4px 10px", fontSize: isMobile ? 13 : 12, opacity: page <= 0 ? 0.4 : 1 }} disabled={page <= 0 || busy} onClick={() => goPage(page - 1)}>‹ ก่อนหน้า</button>
                  <span style={{ fontSize: 12, color: C.sub }}>{page + 1}/{pages}</span>
                  <button style={{ ...btn(C.border), padding: isMobile ? "8px 14px" : "4px 10px", fontSize: isMobile ? 13 : 12, opacity: page + 1 >= pages ? 0.4 : 1 }} disabled={page + 1 >= pages || busy} onClick={() => goPage(page + 1)}>ถัดไป ›</button>
                </span>
              </div>
            );
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: isMobile ? "48vh" : "72vh", overflowY: "auto" }}>
            {users.map((u) => (
              <button key={u.anonId} onClick={() => select(u)} style={{ textAlign: "left", background: selected?.anonId === u.anonId ? "#1e2a40" : C.inputBg, border: `1px solid ${selected?.anonId === u.anonId ? C.accent : C.border}`, borderRadius: 8, padding: "9px 11px", color: C.text, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "(ไม่มีชื่อ)"}</span>
                  {u.provider && <ProviderBadge provider={u.provider} />}
                  {u.hasProfile === false && <span style={{ fontSize: 9, color: C.warn, border: `1px solid ${C.warn}`, borderRadius: 6, padding: "1px 5px" }}>ยังไม่ตั้งชื่อ</span>}
                </div>
                <div style={{ fontSize: 12, color: C.sub }}>เกิด {u.birthDate ?? "—"}{u.timeUnknown ? " · ไม่ทราบเวลา" : u.birthTime ? ` ${u.birthTime}` : ""} · {u.gender ?? "—"} · QI {u.qi}</div>
                {(u.providerName || u.email) && <div style={{ fontSize: 11, color: C.sub }}>{u.providerName ? `ไลน์/บัญชี: ${u.providerName}` : ""}{u.providerName && u.email ? " · " : ""}{u.email ?? ""}</div>}
                <div style={{ fontSize: 10, color: C.sub, opacity: 0.7 }}>{u.anonId}{u.lineId ? ` · LINE id ${u.lineId}` : ""}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── รายละเอียด/แก้ไข ── */}
        <div id="ops-user-detail" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!selected ? (
            <div style={{ ...box, color: C.sub }}>เลือกผู้ใช้จากรายชื่อทางซ้ายเพื่อแก้ไข</div>
          ) : (
            <>
              <ProfileCard user={selected} setUser={setSelected} secret={secret} onSaved={(m) => { note(true, m); void refreshSelectedFromList(); }} onError={(m) => note(false, m)} />
              <PackageCard anonId={selected.anonId} secret={secret} sub={sub} reload={() => loadSub(selected.anonId)} onSaved={(m) => note(true, m)} onError={(m) => note(false, m)} />
              <QiCard user={selected} secret={secret} ledger={ledger} reloadLedger={() => loadLedger(selected.anonId)} onSaved={(qi, m) => { setSelected((s) => (s ? { ...s, qi } : s)); note(true, m); void refreshSelectedFromList(); }} onError={(m) => note(false, m)} />
              <FeatureAccessCard anonId={selected.anonId} secret={secret} status={chatStatus} ledger={ledger} reload={() => { void loadChatStatus(selected.anonId); void loadEntitlements(selected.anonId); }} onSaved={(m) => note(true, m)} onError={(m) => note(false, m)} />
              <EntitlementCard anonId={selected.anonId} secret={secret} entitlements={entitlements} reload={() => loadEntitlements(selected.anonId)} onSaved={(m) => note(true, m)} onError={(m) => note(false, m)} />
              <UserAttributionCard anonId={selected.anonId} secret={secret} />
              <DeleteAccountCard
                user={selected}
                secret={secret}
                onDeleted={(m) => { note(true, m); setSelected(null); void loadUsers(q, page, providerFilter); }}
                onError={(m) => note(false, m)}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function DeleteAccountCard({ user, secret, onDeleted, onError }: { user: UserRow; secret: string; onDeleted: (m: string) => void; onError: (m: string) => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = typed.trim() === user.anonId;
  const del = async () => {
    if (!ok) return;
    if (!window.confirm("ลบบัญชีนี้ถาวร? กู้คืนไม่ได้ (ผู้ใช้ต้องสมัครใหม่)")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/ops/user-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, anonId: user.anonId }) });
      const j = await r.json();
      if (!r.ok) return onError(j.error ?? "ลบบัญชีไม่สำเร็จ");
      const n = Object.values((j.deleted ?? {}) as Record<string, number>).reduce((a, b) => a + Number(b), 0);
      onDeleted(`ลบบัญชีแล้ว (${n} แถว) — ให้ผู้ใช้สมัคร LINE ใหม่ได้เลย`);
    } catch { onError("เชื่อมต่อไม่ได้"); } finally { setBusy(false); }
  };
  return (
    <div style={{ ...box, borderColor: "#7d3b3b", background: "#2a1a1a" }}>
      <h2 style={{ fontSize: 15, margin: 0, color: "#e88" }}>ลบบัญชี (ลบออกจาก data — สมัครใหม่เท่านั้น)</h2>
      <p style={{ fontSize: 12, color: C.sub, margin: "8px 0 4px" }}>
        ลบ mapping LINE + สมาชิก + สิทธิ์ + QI + โปรไฟล์ + identity. <b>ลบถาวร กู้คืนไม่ได้.</b>
        {user.lineId ? <> · LINE id <code>{user.lineId}</code></> : null}
      </p>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>พิมพ์ anonId ให้ตรงเพื่อยืนยัน: <code style={{ userSelect: "all" }}>{user.anonId}</code></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input style={{ ...input, minWidth: 280 }} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="วาง anonId ที่นี่" />
        <button style={{ ...btn(ok ? "#c0392b" : "#5a3535"), fontWeight: 700, cursor: ok && !busy ? "pointer" : "not-allowed" }} disabled={!ok || busy} onClick={del}>{busy ? "กำลังลบ…" : "ลบบัญชีถาวร"}</button>
      </div>
    </div>
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
          displayName: user.handle?.trim() || undefined, // @name (ไม่ส่งถ้าว่าง — คอลัมน์ NOT NULL)
          gender: user.gender || null,
          birthProvince: user.birthProvince || null,
          birth: user.birthDate || undefined,
          birthTime: user.timeUnknown ? null : user.birthTime || null,
          timeUnknown: user.timeUnknown,
        }),
      });
      const j = await r.json();
      if (r.status === 409) return onError(j.error ?? "@name นี้มีคนใช้แล้ว");
      if (!r.ok) return onError(j.error ?? "บันทึกโปรไฟล์ไม่สำเร็จ");
      if (!j.updated && !j.legacySynced) return onError("ไม่พบผู้ใช้/ไม่มีแถวให้แก้");
      onSaved(j.updated ? "บันทึกโปรไฟล์/ชื่อ/วันเกิดแล้ว" : "บันทึกวันเกิด (legacy) แล้ว — ผู้ใช้ยังไม่ตั้ง @name");
    } catch { onError("เชื่อมต่อไม่ได้"); } finally { setSaving(false); }
  };
  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>โปรไฟล์ · ชื่อ · วัน-เวลาเกิด</h2>
        {user.provider && <ProviderBadge provider={user.provider} />}
        {user.providerName && <span style={{ fontSize: 12, color: C.sub }}>ไลน์/บัญชี: {user.providerName}</span>}
        {user.lineId && <span style={{ fontSize: 11, color: C.sub }}>· LINE id {user.lineId}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}><label style={label}>@name (ชื่อที่ตั้ง · unique)</label><input style={input} value={user.handle ?? ""} onChange={(e) => set({ handle: e.target.value })} placeholder="เช่น gggfw" /></div>
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

function FeatureAccessCard({ anonId, secret, status, ledger, reload, onSaved, onError }: { anonId: string; secret: string; status: ChatStatus | null; ledger: LedgerRow[]; reload: () => void; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const [code, setCode] = useState<string>(FEATURES[0].code);
  const [credits, setCredits] = useState("");
  const [saving, setSaving] = useState(false);
  const feat = FEATURES.find((f) => f.code === code) ?? FEATURES[0];

  // "ไม่จำกัด (ไม่หัก QI)" ที่แอดมิน override — มาจาก status.unlimited[code] (ทุกฟีเจอร์)
  const overrideUnlimited = !!status?.unlimited?.[code];
  // แชท/การ์ด อาจ "ไม่จำกัด" จาก tier ด้วย (status.chat.unlimited) — โชว์ป้ายรวม
  const tierUnlimited = (code === "chat_question" && !!status?.chat?.unlimited && !overrideUnlimited);
  const unlimited = overrideUnlimited || tierUnlimited;

  // POST/DELETE แถว entitlement (kind = "unlimited" | เครดิต) ผ่าน endpoint เดิม
  const post = async (body: Record<string, unknown>, okMsg: string) => {
    setSaving(true);
    try {
      const r = await fetch("/api/ops/entitlement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, anonId, ...body }) });
      const j = await r.json();
      if (!r.ok) return onError(j.error ?? "บันทึกไม่สำเร็จ");
      onSaved(okMsg); setCredits(""); reload();
    } catch { onError("เชื่อมต่อไม่ได้"); } finally { setSaving(false); }
  };
  const del = async (body: Record<string, unknown>, okMsg: string) => {
    setSaving(true);
    try {
      const r = await fetch("/api/ops/entitlement", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, anonId, ...body }) });
      const j = await r.json();
      if (!r.ok) return onError(j.error ?? "ยกเลิกไม่สำเร็จ");
      onSaved(okMsg); reload();
    } catch { onError("เชื่อมต่อไม่ได้"); } finally { setSaving(false); }
  };

  const setUnlimited = () => post({ kind: "unlimited", sku: code, credits: 0 }, `ตั้ง "${feat.label}" ไม่จำกัด (ไม่หัก QI) แล้ว`);
  const clearUnlimited = () => del({ kind: "unlimited", sku: code }, `ยกเลิกไม่จำกัด "${feat.label}" แล้ว (กลับไปหัก QI ตามปกติ)`);
  const setCredit = (v: number) => post({ kind: code, sku: "", credits: v }, v === 0 ? `ตัดเครดิต "${feat.label}" เป็น 0 แล้ว` : `ตั้งเครดิต "${feat.label}" = ${v} แล้ว`);

  // stat สำหรับฟีเจอร์ที่มีตัวนับรายวัน (การ์ด/แชท)
  const line = code === "card_use" ? status?.card : code === "chat_question" ? status?.chat : undefined;
  const creditNow = code === "matching_slot" ? status?.matchingCredits ?? 0 : line?.credits ?? 0;
  const featLedger = ledger.filter((l) => l.reason.includes(code));

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>สิทธิ์ / โควตาการใช้งาน</h2>
        {status?.tier && <TierBadge tier={String(status.tier).toUpperCase()} />}
        {unlimited && <span style={{ fontSize: 11, fontWeight: 700, color: C.good, border: `1px solid ${C.good}`, borderRadius: 6, padding: "1px 7px" }}>ไม่จำกัด{tierUnlimited ? " (tier)" : ""}</span>}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label}>เลือกฟีเจอร์</label>
        <select style={input} value={code} onChange={(e) => setCode(e.target.value)}>
          {FEATURES.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
        </select>
        <p style={{ color: C.sub, fontSize: 12, margin: "8px 0 0" }}>
          {feat.credit ? "ลำดับการใช้: ฟรีรายวัน (ตาม tier) → เครดิตที่แลก/ซื้อ → หัก QI" : `หัก ${feat.qi} QI ต่อครั้ง (ไม่มีคลังเครดิตแยก)`} · {feat.note}
        </p>
      </div>

      {!status ? (
        <p style={{ color: C.sub, fontSize: 13 }}>กำลังโหลด…</p>
      ) : status.available === false ? (
        <p style={{ color: C.warn, fontSize: 13 }}>{status.note ?? "ดูโควตาไม่ได้บนเครื่องนี้ (ใช้ได้บน prod)"}</p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            {line ? (
              unlimited ? (
                <Stat label="วันนี้" value="ไม่จำกัด" hint="ไม่หัก QI" good />
              ) : (
                <Stat label="ฟรีวันนี้" value={`${line.usedToday}/${line.freeLimit}`} hint={`เหลือวันนี้ ${line.freeRemaining}`} />
              )
            ) : null}
            {feat.credit && <Stat label="เครดิตเพิ่ม" value={unlimited ? "∞" : String(creditNow)} hint="ใช้ต่อเมื่อฟรีหมด (แลก/ซื้อ/แอดมินให้)" warn={!unlimited && creditNow > 0} good={unlimited} />}
            {!feat.credit && <Stat label="สถานะ" value={unlimited ? "ไม่จำกัด" : `หัก ${feat.qi} QI/ครั้ง`} hint={unlimited ? "แอดมินให้ใช้ไม่อั้น" : "ปกติ"} good={unlimited} />}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
            {overrideUnlimited ? (
              <button style={btn(C.danger)} disabled={saving} onClick={clearUnlimited}>{saving ? "…" : "ยกเลิกไม่จำกัด"}</button>
            ) : (
              <button style={btn(C.accent)} disabled={saving} onClick={setUnlimited}>{saving ? "…" : "ให้ไม่จำกัด (ไม่หัก QI)"}</button>
            )}
            {feat.credit && (
              <>
                <div style={{ width: 150 }}><label style={label}>ตั้งเครดิต (ตายตัว)</label><input style={input} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="เช่น 50" /></div>
                <button style={btn(C.good)} disabled={saving || credits.trim() === "" || !Number.isInteger(Number(credits))} onClick={() => setCredit(Math.max(0, Math.trunc(Number(credits))))}>{saving ? "…" : "ตั้งเครดิต → DB"}</button>
                <button style={btn(C.border)} disabled={saving} onClick={() => setCredit(0)}>ตัดเครดิต (0)</button>
              </>
            )}
          </div>

          {tierUnlimited && (
            <p style={{ color: C.warn, fontSize: 12, margin: "12px 0 0" }}>⚠️ ระดับสมาชิก {status.tier} = แชทไม่จำกัดอยู่แล้ว (ตาม tier) ถ้าจะจำกัดต้องลดแพ็กเกจเป็น FREE ก่อน</p>
          )}

          <div style={{ marginTop: 14, fontSize: 12, color: C.sub }}>
            ประวัติที่หัก QI จากฟีเจอร์นี้ — {featLedger.length} รายการ
            {featLedger.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {featLedger.slice(0, 10).map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 11px" }}>
                    <span style={{ color: l.qiDelta >= 0 ? C.good : C.danger, fontWeight: 700, width: 56 }}>{l.qiDelta >= 0 ? `+${l.qiDelta}` : l.qiDelta}</span>
                    <span style={{ color: C.sub, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.reason}</span>
                    <span style={{ marginLeft: "auto", color: C.sub }}>{String(l.createdAt).slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            )}
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

function ProviderBadge({ provider }: { provider: string }) {
  const p = provider.toUpperCase();
  const isLine = p === "LINE";
  const isGoogle = p === "GOOGLE";
  const color = isLine ? "#06C755" : isGoogle ? "#4285F4" : C.sub;
  const label = isLine ? "LINE" : isGoogle ? "Google" : provider;
  return <span style={{ fontSize: 9, fontWeight: 700, color, border: `1px solid ${color}`, borderRadius: 6, padding: "1px 6px" }}>{label}</span>;
}

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

// ── โปรไฟล์รายคน (#3): จ่ายเงิน · คูปองที่ใช้ · เข้ามาทางไหน · ชวน/ถูกชวน (read-only, /api/ops/user-attribution)
type Attribution = {
  payments: Array<{ package_code?: string; tier_code?: string; baht?: number | string; method?: string; day?: string }>;
  discounts: Array<{ code?: string; baht?: number | string; day?: string }>;
  rewards: Array<{ code?: string; kind?: string; day?: string }>;
  shares?: { total: number; byTag: Array<{ tag?: string; shares?: number; last_day?: string }> };
  providers: Array<string | undefined>;
  referredBy: { id?: string; name?: string | null } | null;
  referred: { count: number; list: Array<{ id?: string; name?: string | null }> };
};

const PROVIDER_LABEL: Record<string, string> = { google: "Google", line: "LINE", facebook: "Facebook", apple: "Apple", email: "อีเมล", password: "อีเมล" };

function UserAttributionCard({ anonId, secret }: { anonId: string; secret: string }) {
  const [data, setData] = useState<Attribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(""); setData(null);
    (async () => {
      try {
        const r = await fetch(`/api/ops/user-attribution?anonId=${encodeURIComponent(anonId)}`, { headers: { "x-ops-secret": secret } });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) { setErr(j.error ?? "โหลดไม่สำเร็จ"); return; }
        setData(j);
      } catch { if (alive) setErr("เชื่อมต่อไม่ได้"); } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [anonId, secret]);

  const row: React.CSSProperties = { background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 11px", fontSize: 13, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" };
  const sub: React.CSSProperties = { color: C.sub, fontSize: 12, margin: "10px 0 6px", fontWeight: 600 };

  return (
    <div style={box}>
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>ที่มา & กิจกรรมของผู้ใช้</h2>
      <p style={{ color: C.sub, fontSize: 12, margin: "0 0 4px" }}>จ่ายเงินอะไร · ใช้คูปองไหน · สมัครเข้ามาทางไหน · ใครชวน / ชวนใครบ้าง (อ่านอย่างเดียว)</p>
      {loading ? (
        <p style={{ color: C.sub, fontSize: 13, margin: "8px 0 0" }}>กำลังโหลด…</p>
      ) : err ? (
        <p style={{ color: C.danger, fontSize: 13, margin: "8px 0 0" }}>{err}</p>
      ) : !data ? null : (
        <>
          <div style={sub}>เข้ามาทางไหน (การสมัคร)</div>
          {data.providers.length === 0 ? (
            <p style={{ color: C.sub, fontSize: 13, margin: 0 }}>—</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {data.providers.map((p, i) => (
                <span key={`${p}:${i}`} style={{ background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 10px", fontSize: 12 }}>{PROVIDER_LABEL[String(p ?? "").toLowerCase()] ?? p ?? "?"}</span>
              ))}
            </div>
          )}

          <div style={sub}>จ่ายเงิน ({data.payments.length})</div>
          {data.payments.length === 0 ? (
            <p style={{ color: C.sub, fontSize: 13, margin: 0 }}>ยังไม่มีการชำระเงิน</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.payments.map((p, i) => (
                <div key={i} style={row}>
                  <span style={{ fontWeight: 600 }}>{p.package_code ?? p.tier_code ?? "—"}</span>
                  <span style={{ color: C.good }}>฿{p.baht}</span>
                  {p.method ? <span style={{ color: C.sub }}>{p.method}</span> : null}
                  <span style={{ color: C.sub, marginLeft: "auto" }}>{p.day}</span>
                </div>
              ))}
            </div>
          )}

          <div style={sub}>คูปองที่ใช้ ({data.discounts.length + data.rewards.length})</div>
          {data.discounts.length + data.rewards.length === 0 ? (
            <p style={{ color: C.sub, fontSize: 13, margin: 0 }}>ยังไม่ได้ใช้คูปอง</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.discounts.map((d, i) => (
                <div key={`d${i}`} style={row}>
                  <span style={{ background: C.accent, color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>ส่วนลด</span>
                  <span style={{ fontWeight: 600 }}>{d.code}</span>
                  <span style={{ color: C.good }}>−฿{d.baht}</span>
                  <span style={{ color: C.sub, marginLeft: "auto" }}>{d.day}</span>
                </div>
              ))}
              {data.rewards.map((rw, i) => (
                <div key={`r${i}`} style={row}>
                  <span style={{ background: C.warn, color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>รางวัล</span>
                  <span style={{ fontWeight: 600 }}>{rw.code}</span>
                  <span style={{ color: C.sub }}>{rw.kind}</span>
                  <span style={{ color: C.sub, marginLeft: "auto" }}>{rw.day}</span>
                </div>
              ))}
            </div>
          )}

          <div style={sub}>แชร์ ({data.shares?.total ?? 0} ครั้ง · แชร์อะไร/ครั้งล่าสุด)</div>
          {!data.shares || data.shares.byTag.length === 0 ? (
            <p style={{ color: C.sub, fontSize: 13, margin: 0 }}>ยังไม่ได้แชร์</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.shares.byTag.map((s, i) => (
                <div key={i} style={row}>
                  <span style={{ fontWeight: 600 }}>{s.tag}</span>
                  <span style={{ color: C.accent }}>×{s.shares}</span>
                  <span style={{ color: C.sub, marginLeft: "auto" }}>{s.last_day}</span>
                </div>
              ))}
            </div>
          )}

          <div style={sub}>คนที่ชวนเขามา (ref)</div>
          {data.referredBy ? (
            <div style={row}><span style={{ fontWeight: 600 }}>{data.referredBy.name ?? "(ไม่มีชื่อ)"}</span><span style={{ color: C.sub, fontSize: 11 }}>{data.referredBy.id}</span></div>
          ) : (
            <p style={{ color: C.sub, fontSize: 13, margin: 0 }}>—</p>
          )}

          <div style={sub}>เขาชวนคนอื่น ({data.referred.count})</div>
          {data.referred.count === 0 ? (
            <p style={{ color: C.sub, fontSize: 13, margin: 0 }}>ยังไม่ได้ชวนใคร</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.referred.list.map((u, i) => (
                <div key={i} style={row}><span style={{ fontWeight: 600 }}>{u.name ?? "(ไม่มีชื่อ)"}</span><span style={{ color: C.sub, fontSize: 11 }}>{u.id}</span></div>
              ))}
              {data.referred.count > data.referred.list.length ? (
                <p style={{ color: C.sub, fontSize: 12, margin: 0 }}>…และอีก {data.referred.count - data.referred.list.length} คน</p>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── คูปอง (#2 Phase 2) — 2 เลนใน CRUD เดียว (secret-gated):
//    · แจกรางวัล (QI/เครดิต/tier) → /api/ops/coupon (activity_coupon, แลกที่ /v2/qi)
//    · ลดราคาตอนจ่ายเงิน → /api/ops/discount (discount_code, กรอกตอน checkout) ── ซินแสนุ้ย 2026-09-14
type CouponRow = {
  id: string; code: string; rewardKind: string; rewardQi: number; creditCount: number;
  tierSku: string | null; tierDays: number; startsAt: string | null; endsAt: string | null;
  maxUseTotal: number | null; maxUsePerUser: number | null; usedCount: number; status: string; createdAt: string;
};
type DiscountRow = {
  id: string; code: string; kind: "PERCENT" | "FIXED"; value: number; maxDiscountSatang: number | null;
  startsAt: string | null; endsAt: string | null; maxUseTotal: number | null; maxUsePerUser: number | null;
  usedCount: number; distinctUsers: number; status: string; createdAt: string;
};
type RedemptionRow = { userId: string; name: string; discountSatang: number; redeemedAt: string | null };
// รายออเดอร์จ่ายสำเร็จ + ชื่อบัญชีผู้ซื้อ ("ใครซื้ออะไร") จาก /api/ops/analytics revenue.recent
type OrderRow = { at: string; package_code: string; tier_code: string | null; method: string | null; baht: number; anon_id: string; u_name: string | null; u_surname: string | null; email: string | null; provider: string | null; provider_name: string | null };
// กลุ่มลูกค้า (PLUS/PRO/QI>500) จาก /api/ops/segment — เป็นปุ่มกรอง (tier อาจ null สำหรับ qi500 ที่เป็น FREE)
type SegmentRow = { anon_id: string; tier_code: string | null; expire_at: string | null; qi: number; u_name: string | null; u_surname: string | null; email: string | null; provider: string | null; provider_name: string | null };
type RewardKind = "qi" | "chat" | "card" | "matching" | "tier" | "discount";

type Analytics = {
  days: number;
  dau: { total: number; byDay: { day: string; users: number }[] };
  features: { feature: string; uses: number; users: number }[];
  revenue: { total: { orders: number; baht: number }; byDay: { day: string; orders: number; baht: number }[]; byPackage: { package_code: string; orders: number; baht: number }[]; recent?: OrderRow[] };
  coupons: { discount: { total: { uses: number; baht: number; users: number }; byCode: { code: string; uses: number; baht: number }[] }; reward: { uses: number; users: number } };
  shares: { total: { shares: number; users: number }; byTag: { tag: string; shares: number; users: number }[] };
  chat: { topTopics: { topic_id: string; replies: number }[]; byPersona: { persona: string; replies: number }[] };
};

// หากลุ่มลูกค้า: ปุ่ม PLUS / PRO / QI>500 → โหลดจาก /api/ops/segment → ตารางค้นได้ + กดแถวเปิด detail
function SegmentPanel({ secret, onOpenUser }: { secret: string; onOpenUser: (anonId: string) => void }) {
  const [type, setType] = useState<"plus" | "pro" | "qi500" | "">("");
  const [rows, setRows] = useState<SegmentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const td: React.CSSProperties = { borderBottom: `1px solid ${C.border}`, padding: "6px 8px", fontSize: 13 };
  const th: React.CSSProperties = { ...td, textAlign: "left", color: C.sub };
  const nameOf = (o: SegmentRow) => o.provider_name || [o.u_name, o.u_surname].filter(Boolean).join(" ").trim() || o.email || `${o.anon_id.slice(0, 8)}…`;

  const load = async (t: "plus" | "pro" | "qi500") => {
    setType(t); setBusy(true); setErr(null); setRows([]); setQ("");
    try {
      const r = await fetch(`/api/ops/segment?type=${t}`, { headers: { "x-ops-secret": secret } });
      const j = await r.json();
      if (r.ok) setRows(j.users ?? []); else setErr(j.error ?? "โหลดไม่สำเร็จ");
    } catch { setErr("เชื่อมต่อไม่ได้"); } finally { setBusy(false); }
  };

  const filtered = rows.filter((o) => { const s = q.trim().toLowerCase(); return !s || [nameOf(o), o.email, o.anon_id, o.tier_code].some((f) => (f ?? "").toLowerCase().includes(s)); });
  const BTNS: { v: "plus" | "pro" | "qi500"; l: string }[] = [{ v: "plus", l: "PLUS" }, { v: "pro", l: "PRO" }, { v: "qi500", l: "QI > 500" }];

  return (
    <div style={{ ...box, marginBottom: 16 }}>
      <strong style={{ fontSize: 15 }}>👥 หากลุ่มลูกค้า</strong>
      <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
        {BTNS.map((b) => (
          <button key={b.v} onClick={() => load(b.v)} style={{ ...btn(type === b.v ? C.accent : C.inputBg), border: `1px solid ${type === b.v ? "transparent" : C.border}`, fontWeight: 700, padding: "7px 16px" }}>{b.l}</button>
        ))}
      </div>
      {!type ? (
        <p style={{ color: C.sub, fontSize: 13, margin: 0 }}>เลือกกลุ่มที่ต้องการดู (กดปุ่มด้านบน)</p>
      ) : busy ? (
        <p style={{ color: C.sub, fontSize: 13, margin: 0 }}>กำลังโหลด…</p>
      ) : err ? (
        <p style={{ color: C.danger, fontSize: 13, margin: 0 }}>{err}</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.text }}>พบ <b>{rows.length}</b> คน{q ? ` · ตรงคำค้น ${filtered.length}` : ""}</span>
            <input style={{ ...input, maxWidth: 260, fontSize: 12, padding: "6px 10px", marginLeft: "auto" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้น ชื่อ / อีเมล / anonId" />
          </div>
          <div style={{ overflowX: "auto", maxHeight: "56vh", overflowY: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
              <thead><tr><th style={th}>บัญชี</th><th style={th}>tier</th><th style={{ ...th, textAlign: "right" }}>QI</th><th style={th}>หมดอายุ</th></tr></thead>
              <tbody>
                {filtered.length === 0 && <tr><td style={td} colSpan={4}>{rows.length === 0 ? "ไม่มีใครในกลุ่มนี้" : "ไม่พบตามคำค้น"}</td></tr>}
                {filtered.map((o, i) => (
                  <tr key={`${o.anon_id}-${i}`} onClick={() => onOpenUser(o.anon_id)} style={{ cursor: "pointer" }} title="กดเพื่อดู/แก้ไขผู้ใช้">
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: C.accent }}>{nameOf(o)}</div>
                      <div style={{ fontSize: 11, color: C.sub }}>{[o.provider ? o.provider.toUpperCase() : null, o.email].filter(Boolean).join(" · ") || o.anon_id}</div>
                    </td>
                    <td style={td}><span style={{ fontWeight: 700, color: o.tier_code === "PRO" ? C.warn : o.tier_code === "PLUS" ? C.accent : C.sub }}>{o.tier_code ?? "FREE"}</span></td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{Number(o.qi ?? 0).toLocaleString("th-TH")}</td>
                    <td style={{ ...td, color: C.sub, whiteSpace: "nowrap" }}>{o.expire_at ? o.expire_at.slice(0, 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AnalyticsPanel({ secret, onOpenUser }: { secret: string; onOpenUser: (anonId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // ย่อ/ขยาย + ค้นหา ตาราง "ใครซื้ออะไร" (เอ็ม 2026-09-23) — default ย่อไว้
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [ordersQ, setOrdersQ] = useState("");
  const td: React.CSSProperties = { borderBottom: `1px solid ${C.border}`, padding: "6px 8px", fontSize: 13 };
  const th: React.CSSProperties = { ...td, textAlign: "left", color: C.sub };
  // ชื่อผู้ใช้ที่อ่านง่าย (LINE name / ชื่อ-สกุล / email / anonId ย่อ)
  const nameOf = (o: { u_name: string | null; u_surname: string | null; email: string | null; provider_name: string | null; anon_id: string }) =>
    o.provider_name || [o.u_name, o.u_surname].filter(Boolean).join(" ").trim() || o.email || `${o.anon_id.slice(0, 8)}…`;
  // filter helper: ค้นจากชื่อ/email/anonId/แพ็ก (ตัวพิมพ์ไม่สนใจ)
  const matchRow = (q: string, ...fields: (string | null | undefined)[]) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return fields.some((f) => (f ?? "").toLowerCase().includes(s));
  };
  const searchInput: React.CSSProperties = { ...input, maxWidth: 260, fontSize: 12, padding: "6px 10px" };
  const caret: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" };

  const load = useCallback(async () => {
    if (!secret) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/ops/analytics?days=${days}`, { headers: { "x-ops-secret": secret } });
      const j = (await r.json().catch(() => ({}))) as Analytics & { error?: string };
      if (r.ok) setData(j); else setErr(j.error ?? "โหลดไม่สำเร็จ");
    } catch { setErr("เชื่อมต่อไม่ได้"); } finally { setBusy(false); }
  }, [secret, days]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const baht = (n: number) => `฿${Number(n ?? 0).toLocaleString("th-TH")}`;
  const stat = (labelText: string, value: string) => (
    <div style={{ ...box, padding: 12, minWidth: 130 }}>
      <div style={{ fontSize: 12, color: C.sub }}>{labelText}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ ...box, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <strong style={{ fontSize: 15 }}>📊 ภาพรวมรายวัน (DAU · ใช้อะไร · รายรับ · ถามอะไร)</strong>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {open && (
            <select style={{ ...input, width: 110 }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>7 วัน</option><option value={30}>30 วัน</option><option value={90}>90 วัน</option>
            </select>
          )}
          <button style={{ ...btn(C.border), fontWeight: 500 }} onClick={() => setOpen((o) => !o)}>{open ? "ซ่อน" : "ดู"}</button>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          {busy && !data ? <p style={{ color: C.sub }}>กำลังโหลด…</p> : err ? <p style={{ color: C.warn }}>{err}</p> : data ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* การ์ดสรุป */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {stat(`ผู้ใช้ไม่ซ้ำ (${data.days} วัน)`, `${data.dau.total.toLocaleString("th-TH")} คน`)}
                {stat(`รายรับ (${data.days} วัน)`, baht(data.revenue.total.baht))}
                {stat("ออเดอร์ที่จ่ายสำเร็จ", `${data.revenue.total.orders.toLocaleString("th-TH")}`)}
                {stat("ส่วนลดที่ให้ไป", baht(data.coupons.discount.total.baht))}
                {stat("กดแชร์", `${data.shares.total.shares.toLocaleString("th-TH")} ครั้ง · ${data.shares.total.users} คน`)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                {/* ใช้อะไรบ้าง */}
                <div>
                  <p style={{ ...label, marginBottom: 4 }}>ใช้อะไรบ้าง (ครั้ง · คน)</p>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead><tr><th style={th}>ฟีเจอร์</th><th style={{ ...th, textAlign: "right" }}>ครั้ง</th><th style={{ ...th, textAlign: "right" }}>คน</th></tr></thead>
                    <tbody>
                      {data.features.length === 0 && <tr><td style={td} colSpan={3}>ยังไม่มีข้อมูล</td></tr>}
                      {data.features.map((f) => (
                        <tr key={f.feature}><td style={td}>{f.feature}</td><td style={{ ...td, textAlign: "right" }}>{f.uses.toLocaleString("th-TH")}</td><td style={{ ...td, textAlign: "right" }}>{f.users.toLocaleString("th-TH")}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* รายรับแยกแพ็ก + หัวข้อแชท */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <p style={{ ...label, marginBottom: 4 }}>รายรับแยกแพ็กเกจ</p>
                    <table style={{ borderCollapse: "collapse", width: "100%" }}>
                      <thead><tr><th style={th}>แพ็ก</th><th style={{ ...th, textAlign: "right" }}>ออเดอร์</th><th style={{ ...th, textAlign: "right" }}>บาท</th></tr></thead>
                      <tbody>
                        {data.revenue.byPackage.length === 0 && <tr><td style={td} colSpan={3}>ยังไม่มียอดขาย</td></tr>}
                        {data.revenue.byPackage.map((p) => (
                          <tr key={p.package_code}><td style={td}>{p.package_code}</td><td style={{ ...td, textAlign: "right" }}>{p.orders}</td><td style={{ ...td, textAlign: "right" }}>{baht(p.baht)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <p style={{ ...label, marginBottom: 4 }}>ถามอะไรบ้าง (หัวข้อแชท · PDPA-safe)</p>
                    <table style={{ borderCollapse: "collapse", width: "100%" }}>
                      <thead><tr><th style={th}>หัวข้อ</th><th style={{ ...th, textAlign: "right" }}>ครั้ง</th></tr></thead>
                      <tbody>
                        {data.chat.topTopics.length === 0 && <tr><td style={td} colSpan={2}>ยังไม่มีแชท</td></tr>}
                        {data.chat.topTopics.map((t) => (
                          <tr key={t.topic_id}><td style={td}>{t.topic_id}</td><td style={{ ...td, textAlign: "right" }}>{t.replies.toLocaleString("th-TH")}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ใครซื้ออะไร (บัญชี) — ย่อได้ · ค้นได้ · กดแถวเพื่อเปิด detail/แก้ไข */}
              {(() => {
                const all = data.revenue.recent ?? [];
                const rows = all.filter((o) => matchRow(ordersQ, nameOf(o), o.email, o.anon_id, o.package_code, o.tier_code));
                return (
                  <div>
                    <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => setOrdersOpen((v) => !v)} style={{ ...caret, ...label, background: "none", border: "none", padding: 0, color: C.text }}>
                        <span>{ordersOpen ? "▾" : "▸"}</span> ใครซื้ออะไร (บัญชี · แพ็ก · เมื่อไหร่) — ล่าสุด {all.length} ออเดอร์
                      </button>
                      {ordersOpen && <input style={searchInput} value={ordersQ} onChange={(e) => setOrdersQ(e.target.value)} placeholder="ค้น ชื่อ / อีเมล / แพ็ก / anonId" />}
                    </div>
                    {ordersOpen && (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
                          <thead><tr>
                            <th style={th}>เมื่อไหร่</th><th style={th}>บัญชีผู้ซื้อ</th><th style={th}>แพ็ก</th>
                            <th style={th}>วิธี</th><th style={{ ...th, textAlign: "right" }}>บาท</th>
                          </tr></thead>
                          <tbody>
                            {rows.length === 0 && <tr><td style={td} colSpan={5}>{all.length === 0 ? "ยังไม่มีออเดอร์" : "ไม่พบตามคำค้น"}</td></tr>}
                            {rows.map((o, i) => (
                              <tr key={`${o.anon_id}-${o.at}-${i}`} onClick={() => onOpenUser(o.anon_id)} style={{ cursor: "pointer" }} title="กดเพื่อดู/แก้ไขผู้ใช้">
                                <td style={{ ...td, whiteSpace: "nowrap" }}>{o.at}</td>
                                <td style={td}>
                                  <div style={{ fontWeight: 600, color: C.accent }}>{nameOf(o)}</div>
                                  <div style={{ fontSize: 11, color: C.sub }}>{[o.provider ? o.provider.toUpperCase() : null, o.email].filter(Boolean).join(" · ") || o.anon_id}</div>
                                </td>
                                <td style={td}>{o.package_code}{o.tier_code ? <span style={{ color: C.sub }}> · {o.tier_code}</span> : null}</td>
                                <td style={{ ...td, color: C.sub }}>{o.method ?? "—"}</td>
                                <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{baht(o.baht)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}


              {/* ส่วนลด/คูปองที่ใช้ · กดแชร์อะไร · แชทแนวไหน */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                {/* ส่วนลด/คูปอง */}
                <div>
                  <p style={{ ...label, marginBottom: 4 }}>ส่วนลด/คูปองที่ใช้ — ให้ส่วนลด {baht(data.coupons.discount.total.baht)} · {data.coupons.discount.total.uses} ครั้ง · คูปองรางวัลแลก {data.coupons.reward.uses} ครั้ง</p>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead><tr><th style={th}>โค้ดส่วนลด</th><th style={{ ...th, textAlign: "right" }}>ครั้ง</th><th style={{ ...th, textAlign: "right" }}>ลดไป(฿)</th></tr></thead>
                    <tbody>
                      {data.coupons.discount.byCode.length === 0 && <tr><td style={td} colSpan={3}>ยังไม่มีการใช้โค้ดส่วนลด</td></tr>}
                      {data.coupons.discount.byCode.map((c) => (
                        <tr key={c.code}><td style={td}><code>{c.code}</code></td><td style={{ ...td, textAlign: "right" }}>{c.uses}</td><td style={{ ...td, textAlign: "right" }}>{baht(c.baht)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* กดแชร์อะไร */}
                <div>
                  <p style={{ ...label, marginBottom: 4 }}>กดแชร์อะไร (กี่ครั้ง · กี่คน)</p>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead><tr><th style={th}>แชร์</th><th style={{ ...th, textAlign: "right" }}>ครั้ง</th><th style={{ ...th, textAlign: "right" }}>คน</th></tr></thead>
                    <tbody>
                      {data.shares.byTag.length === 0 && <tr><td style={td} colSpan={3}>ยังไม่มีการแชร์</td></tr>}
                      {data.shares.byTag.map((s) => (
                        <tr key={s.tag}><td style={td}>{s.tag}</td><td style={{ ...td, textAlign: "right" }}>{s.shares}</td><td style={{ ...td, textAlign: "right" }}>{s.users}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* แชทแนวไหน (persona) */}
                <div>
                  <p style={{ ...label, marginBottom: 4 }}>แชทแนวไหน (เพอร์โซนา)</p>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead><tr><th style={th}>เพอร์โซนา</th><th style={{ ...th, textAlign: "right" }}>ครั้ง</th></tr></thead>
                    <tbody>
                      {data.chat.byPersona.length === 0 && <tr><td style={td} colSpan={2}>ยังไม่มีแชท</td></tr>}
                      {data.chat.byPersona.map((p) => (
                        <tr key={p.persona}><td style={td}>{p.persona === "mu" ? "เสี่ยวมู่ (ชาย)" : p.persona === "mi" ? "เสี่ยวมี่ (หญิง)" : p.persona}</td><td style={{ ...td, textAlign: "right" }}>{p.replies.toLocaleString("th-TH")}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CouponManager({ secret, onNote }: { secret: string; onNote: (ok: boolean, m: string) => void }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [discRows, setDiscRows] = useState<DiscountRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [rewardKind, setRewardKind] = useState<RewardKind>("qi");
  const [amount, setAmount] = useState("");
  const [tierSku, setTierSku] = useState<"plus" | "pro">("plus");
  const [dkind, setDkind] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [dMaxBaht, setDMaxBaht] = useState("");
  const [maxUsePerUser, setMaxUsePerUser] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxUseTotal, setMaxUseTotal] = useState("");
  const isDiscount = rewardKind === "discount";
  // ใครใช้โค้ดส่วนลด (เปิดดูรายคน)
  const [redFor, setRedFor] = useState<string | null>(null);
  const [redRows, setRedRows] = useState<RedemptionRow[]>([]);
  const [redBusy, setRedBusy] = useState(false);

  const load = useCallback(async () => {
    if (!secret) return;
    try {
      const [cr, dr] = await Promise.all([
        fetch(`/api/ops/coupon?secret=${encodeURIComponent(secret)}`),
        fetch(`/api/ops/discount?secret=${encodeURIComponent(secret)}`),
      ]);
      if (cr.ok) setRows((((await cr.json()) as { coupons?: CouponRow[] }).coupons ?? []));
      if (dr.ok) setDiscRows((((await dr.json()) as { discounts?: DiscountRow[] }).discounts ?? []));
    } catch { /* ignore */ }
  }, [secret]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const resetForm = () => { setCode(""); setAmount(""); setStartsAt(""); setEndsAt(""); setMaxUseTotal(""); setDMaxBaht(""); setMaxUsePerUser(""); };

  // ดู/ปิด "ใครใช้โค้ดนี้บ้าง"
  const viewRedemptions = async (d: DiscountRow) => {
    if (redFor === d.id) { setRedFor(null); setRedRows([]); return; }
    setRedBusy(true);
    setRedFor(d.id);
    try {
      const r = await fetch(`/api/ops/discount?secret=${encodeURIComponent(secret)}&redemptions=${encodeURIComponent(d.id)}`);
      const j = (await r.json().catch(() => ({}))) as { redemptions?: RedemptionRow[] };
      setRedRows(r.ok ? (j.redemptions ?? []) : []);
    } catch { setRedRows([]); } finally { setRedBusy(false); }
  };

  const create = async () => {
    setBusy(true);
    try {
      if (isDiscount) {
        const r = await fetch("/api/ops/discount", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret, action: "create", code, kind: dkind, value: Number(amount), maxDiscountBaht: dkind === "PERCENT" && dMaxBaht ? Number(dMaxBaht) : undefined, startsAt: startsAt || undefined, endsAt: endsAt || undefined, maxUseTotal: maxUseTotal || undefined, maxUsePerUser: maxUsePerUser || undefined }),
        });
        const j = (await r.json().catch(() => ({}))) as { discounts?: DiscountRow[]; reason?: string; error?: string };
        if (!r.ok) { onNote(false, j.reason ?? j.error ?? "สร้างไม่สำเร็จ"); return; }
        setDiscRows(j.discounts ?? []);
        onNote(true, `สร้างโค้ดส่วนลด ${code.toUpperCase()} แล้ว`);
        resetForm();
        return;
      }
      const r = await fetch("/api/ops/coupon", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, action: "create", code, rewardKind, amount: Number(amount), tierSku: rewardKind === "tier" ? tierSku : undefined, startsAt: startsAt || undefined, endsAt: endsAt || undefined, maxUseTotal: maxUseTotal || undefined, maxUsePerUser: maxUsePerUser || undefined }),
      });
      const j = (await r.json().catch(() => ({}))) as { coupons?: CouponRow[]; reason?: string; error?: string };
      if (!r.ok) { onNote(false, j.reason ?? j.error ?? "สร้างไม่สำเร็จ"); return; }
      setRows(j.coupons ?? []);
      onNote(true, `สร้างคูปอง ${code.toUpperCase()} แล้ว`);
      resetForm();
    } finally { setBusy(false); }
  };

  const toggle = async (c: CouponRow) => {
    const next = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setBusy(true);
    try {
      const r = await fetch("/api/ops/coupon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, action: "status", id: c.id, status: next }) });
      const j = (await r.json().catch(() => ({}))) as { coupons?: CouponRow[]; error?: string };
      if (r.ok) setRows(j.coupons ?? []); else onNote(false, j.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
    } finally { setBusy(false); }
  };

  const toggleDisc = async (d: DiscountRow) => {
    const next = d.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setBusy(true);
    try {
      const r = await fetch("/api/ops/discount", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, action: "status", id: d.id, status: next }) });
      const j = (await r.json().catch(() => ({}))) as { discounts?: DiscountRow[]; error?: string };
      if (r.ok) setDiscRows(j.discounts ?? []); else onNote(false, j.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
    } finally { setBusy(false); }
  };

  // ลบคูปอง/โค้ด (เฉพาะที่ยังไม่ถูกใช้ — server กันอีกชั้น)
  const delCoupon = async (c: CouponRow) => {
    if (!window.confirm(`ลบคูปอง ${c.code}? ${c.usedCount > 0 ? `(ถูกใช้ไป ${c.usedCount} ครั้ง — จะลบประวัติการแลกด้วย)` : ""}`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/ops/coupon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, action: "delete", id: c.id }) });
      const j = (await r.json().catch(() => ({}))) as { coupons?: CouponRow[]; reason?: string; error?: string };
      if (r.ok) { setRows(j.coupons ?? []); onNote(true, `ลบ ${c.code} แล้ว`); } else onNote(false, j.reason ?? j.error ?? "ลบไม่สำเร็จ");
    } finally { setBusy(false); }
  };
  const delDisc = async (d: DiscountRow) => {
    if (!window.confirm(`ลบโค้ด ${d.code}? (ลบไม่ได้ถ้าถูกใช้ไปแล้ว)`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/ops/discount", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, action: "delete", id: d.id }) });
      const j = (await r.json().catch(() => ({}))) as { discounts?: DiscountRow[]; reason?: string; error?: string };
      if (r.ok) { setDiscRows(j.discounts ?? []); onNote(true, `ลบ ${d.code} แล้ว`); } else onNote(false, j.reason ?? j.error ?? "ลบไม่สำเร็จ");
    } finally { setBusy(false); }
  };

  const rewardText = (c: CouponRow) =>
    c.rewardKind === "qi" ? `QI +${c.rewardQi}` : c.rewardKind === "chat" ? `แชท +${c.creditCount}` : c.rewardKind === "card" ? `เปิดไพ่ +${c.creditCount}` : c.rewardKind === "matching" ? `แมทช์สมพงศ์ +${c.creditCount}` : `${(c.tierSku ?? "").toUpperCase()} ${c.tierDays}วัน`;
  const discText = (d: DiscountRow) =>
    d.kind === "PERCENT" ? `ลด ${d.value}%${d.maxDiscountSatang ? ` (สูงสุด ${(d.maxDiscountSatang / 100).toLocaleString("th-TH")}฿)` : ""}` : `ลด ${(d.value / 100).toLocaleString("th-TH")}฿`;
  const amountLabel = isDiscount ? (dkind === "PERCENT" ? "ลด (%)" : "ลด (บาท)") : rewardKind === "tier" ? "จำนวนวัน" : rewardKind === "qi" ? "จำนวน QI" : rewardKind === "matching" ? "จำนวนแมทช์" : "จำนวนเครดิต";
  const td: React.CSSProperties = { borderBottom: `1px solid ${C.border}`, padding: "6px 8px", fontSize: 13 };

  return (
    <div style={{ ...box, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <strong style={{ fontSize: 15 }}>🎟️ คูปอง (แจก QI / เครดิต / tier · หรือ ลดราคาตอนจ่ายเงิน)</strong>
        <button style={{ ...btn(C.border), marginLeft: "auto", fontWeight: 500 }} onClick={() => setOpen((o) => !o)}>{open ? "ซ่อน" : "จัดการ"}</button>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
            <div><span style={label}>โค้ด</span><input style={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="SONGKRAN" /></div>
            <div><span style={label}>ประเภท</span>
              <select style={input} value={rewardKind} onChange={(e) => setRewardKind(e.target.value as RewardKind)}>
                <option value="qi">QI</option><option value="chat">เครดิตแชท</option><option value="card">เครดิตเปิดไพ่</option><option value="matching">แมทช์สมพงศ์</option><option value="tier">Tier (วัน)</option><option value="discount">ลดราคา (ตอนจ่ายเงิน)</option>
              </select>
            </div>
            {isDiscount && <div><span style={label}>ชนิดส่วนลด</span><select style={input} value={dkind} onChange={(e) => setDkind(e.target.value as "PERCENT" | "FIXED")}><option value="PERCENT">เปอร์เซ็นต์ %</option><option value="FIXED">จำนวนเงิน ฿</option></select></div>}
            <div><span style={label}>{amountLabel}</span><input style={input} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={isDiscount && dkind === "PERCENT" ? "1-99" : rewardKind === "tier" ? "เช่น 30" : undefined} />
              {/* ปุ่มลัด top-up tier — กดเติมจำนวนวันมาตรฐาน (เอ็ม 2026-09-20: 7/14/30/60/90/180/365) ไม่ต้องพิมพ์เอง */}
              {rewardKind === "tier" && (
                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                  {[[7, "7 วัน"], [14, "14 วัน"], [30, "1 เดือน"], [60, "2 เดือน"], [90, "3 เดือน"], [180, "6 เดือน"], [365, "1 ปี"]].map(([d, lbl]) => (
                    <button key={d} type="button" onClick={() => setAmount(String(d))}
                      style={{ ...btn(amount === String(d) ? C.accent : C.inputBg), border: `1px solid ${amount === String(d) ? "transparent" : C.border}`, fontSize: 12, fontWeight: 600, padding: "3px 9px", minWidth: 0 }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {rewardKind === "tier" && <div><span style={label}>Tier</span><select style={input} value={tierSku} onChange={(e) => setTierSku(e.target.value as "plus" | "pro")}><option value="plus">PLUS</option><option value="pro">PRO</option></select></div>}
            {isDiscount && dkind === "PERCENT" && <div><span style={label}>เพดานลด (บาท)</span><input style={input} type="number" value={dMaxBaht} onChange={(e) => setDMaxBaht(e.target.value)} placeholder="เว้น=ไม่จำกัด" /></div>}
            <div><span style={label}>จำกัด/คน (ครั้ง)</span><input style={input} type="number" value={maxUsePerUser} onChange={(e) => setMaxUsePerUser(e.target.value)} placeholder={isDiscount ? "เว้น=ไม่จำกัด" : "เว้น=1 ครั้ง/คน"} /></div>
            <div><span style={label}>ใช้รวม (ครั้ง)</span><input style={input} type="number" value={maxUseTotal} onChange={(e) => setMaxUseTotal(e.target.value)} placeholder="เว้น=ไม่จำกัด" /></div>
            <div><span style={label}>เริ่ม</span><input style={input} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
            <div><span style={label}>หมดอายุ</span><input style={input} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
            <div style={{ display: "flex", alignItems: "flex-end" }}><button style={btn(C.good)} disabled={busy || !code.trim() || !amount} onClick={create}>{busy ? "…" : isDiscount ? "สร้างโค้ดส่วนลด" : "สร้างคูปอง"}</button></div>
          </div>

          <p style={{ ...label, marginBottom: 4 }}>แจกรางวัล (แลกที่หน้า /v2/qi)</p>
          {/* มือถือ: ครอบ overflow-x ให้ตารางเลื่อนแนวนอนแทนบีบจนอ่านไม่ออก (6 คอลัมน์) */}
          <div style={{ overflowX: "auto", marginBottom: 18, WebkitOverflowScrolling: "touch" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: isMobile ? 560 : undefined }}>
            <thead><tr style={{ textAlign: "left", color: C.sub }}><th style={td}>โค้ด</th><th style={td}>รางวัล</th><th style={td}>ช่วงเวลา</th><th style={td}>ใช้แล้ว</th><th style={td}>สถานะ</th><th style={td} /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td style={td} colSpan={6}>ยังไม่มีคูปองรางวัล</td></tr>}
              {rows.map((c) => (
                <tr key={c.id}>
                  <td style={td}><code>{c.code}</code></td>
                  <td style={td}>{rewardText(c)}</td>
                  <td style={td}>{c.startsAt ? new Date(c.startsAt).toLocaleDateString("th-TH") : "—"} → {c.endsAt ? new Date(c.endsAt).toLocaleDateString("th-TH") : "—"}</td>
                  <td style={td}>{c.usedCount}/{c.maxUseTotal ?? "∞"} · {c.maxUsePerUser ?? 1}/คน</td>
                  <td style={{ ...td, color: c.status === "ACTIVE" ? C.good : c.status === "PAUSED" ? C.warn : C.sub }}>{c.status}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {c.status !== "EXPIRED" && <button style={{ ...btn(C.border), fontWeight: 500 }} disabled={busy} onClick={() => toggle(c)}>{c.status === "ACTIVE" ? "พัก" : "เปิด"}</button>}
                    <button style={{ ...btn(C.warn), fontWeight: 500, marginLeft: 6 }} disabled={busy} onClick={() => delCoupon(c)}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <p style={{ ...label, marginBottom: 4 }}>ลดราคา (กรอกตอนจ่ายเงิน)</p>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: isMobile ? 560 : undefined }}>
            <thead><tr style={{ textAlign: "left", color: C.sub }}><th style={td}>โค้ด</th><th style={td}>ส่วนลด</th><th style={td}>ช่วงเวลา</th><th style={td}>ใช้แล้ว</th><th style={td}>สถานะ</th><th style={td} /></tr></thead>
            <tbody>
              {discRows.length === 0 && <tr><td style={td} colSpan={6}>ยังไม่มีโค้ดส่วนลด</td></tr>}
              {discRows.map((d) => (
                <Fragment key={d.id}>
                <tr>
                  <td style={td}><code>{d.code}</code></td>
                  <td style={td}>{discText(d)}{d.maxUsePerUser ? ` · จำกัด ${d.maxUsePerUser}/คน` : ""}</td>
                  <td style={td}>{d.startsAt ? new Date(d.startsAt).toLocaleDateString("th-TH") : "—"} → {d.endsAt ? new Date(d.endsAt).toLocaleDateString("th-TH") : "—"}</td>
                  <td style={td}>{d.usedCount}/{d.maxUseTotal ?? "∞"} ครั้ง · {d.distinctUsers} คน</td>
                  <td style={{ ...td, color: d.status === "ACTIVE" ? C.good : d.status === "PAUSED" ? C.warn : C.sub }}>{d.status}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button style={{ ...btn(C.border), fontWeight: 500 }} disabled={redBusy && redFor === d.id} onClick={() => viewRedemptions(d)}>{redFor === d.id ? "ซ่อน" : "ดูผู้ใช้"}</button>
                    {d.status !== "EXPIRED" && <button style={{ ...btn(C.border), fontWeight: 500, marginLeft: 6 }} disabled={busy} onClick={() => toggleDisc(d)}>{d.status === "ACTIVE" ? "พัก" : "เปิด"}</button>}
                    {d.usedCount === 0 && <button style={{ ...btn(C.warn), fontWeight: 500, marginLeft: 6 }} disabled={busy} onClick={() => delDisc(d)}>ลบ</button>}
                  </td>
                </tr>
                {redFor === d.id && (
                  <tr>
                    <td style={{ ...td, background: C.bg }} colSpan={6}>
                      {redBusy ? "กำลังโหลด…" : redRows.length === 0 ? "ยังไม่มีใครใช้โค้ดนี้" : (
                        <div>
                          <div style={{ ...label, marginBottom: 6 }}>ผู้ใช้โค้ด {d.code} — {new Set(redRows.map((x) => x.userId)).size} คน · {redRows.length} ครั้ง</div>
                          <table style={{ borderCollapse: "collapse", width: "100%" }}>
                            <thead><tr style={{ textAlign: "left", color: C.sub }}><th style={td}>ผู้ใช้</th><th style={td}>ลดไป</th><th style={td}>เมื่อ</th></tr></thead>
                            <tbody>
                              {redRows.map((u, i) => (
                                <tr key={`${u.userId}-${i}`}>
                                  <td style={td}>{u.name}</td>
                                  <td style={td}>{(u.discountSatang / 100).toLocaleString("th-TH")}฿</td>
                                  <td style={td}>{u.redeemedAt ? new Date(u.redeemedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
