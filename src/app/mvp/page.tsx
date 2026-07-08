"use client";

/**
 * /mvp — หน้าเดโม UI ใหม่ (Mumate) สไตล์แอปมือถือ ให้ทีมกดเล่นได้จริงทุกระบบ
 * ทุกอย่างเรียก API จริงของ repo นี้ (ดู docs/newui-api.md) — anonId เก็บใน localStorage
 * เป็น MVP โชว์ flow ไม่ใช่ดีไซน์จริง (ดีไซน์จริงอยู่ Figma ของทีม UI)
 */

import { useCallback, useEffect, useMemo, useState } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────
async function api<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

function useAnonId(): string {
  const [id, setId] = useState("");
  useEffect(() => {
    let v = localStorage.getItem("mvp-anon-id");
    if (!v) {
      v = `mvp-${crypto.randomUUID().slice(0, 12)}`;
      localStorage.setItem("mvp-anon-id", v);
    }
    setId(v);
  }, []);
  return id;
}

type Birth = { birthDate: string; birthTime: string; gender: string };

function useBirth(): [Birth | null, (b: Birth) => void] {
  const [birth, setBirth] = useState<Birth | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem("mvp-birth");
    if (raw) setBirth(JSON.parse(raw));
  }, []);
  const save = useCallback((b: Birth) => {
    localStorage.setItem("mvp-birth", JSON.stringify(b));
    setBirth(b);
  }, []);
  return [birth, save];
}

const MOODS = ["😞", "😕", "😐", "🙂", "😄"];
const VERDICT_TH: Record<string, string> = { good: "วันนี้ดวงดี", ok: "วันนี้พอใช้", caution: "วันนี้ควรระวัง" };
const FOCUS_OPTIONS = [
  ["love", "❤️ ความรัก"],
  ["work", "💼 การงาน"],
  ["wealth", "💰 การเงิน"],
  ["health", "🌿 สุขภาพ"],
  ["family", "👨‍👩‍👧 ครอบครัว"],
  ["self_development", "✨ พัฒนาตนเอง"],
] as const;

// ── Onboarding ───────────────────────────────────────────────────────────────
function Onboarding({ anonId, onDone }: { anonId: string; onDone: (b: Birth) => void }) {
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState<string[]>([]);
  const [birthDate, setBirthDate] = useState("1996-01-12");
  const [birthTime, setBirthTime] = useState("09:30");
  const [gender, setGender] = useState("unspecified");
  const [summary, setSummary] = useState<{ elementTh?: string; tagline?: string; traits?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const submitBirth = async () => {
    setBusy(true);
    try {
      await api("/api/user/intent", { method: "POST", json: { anonId, focus } });
      const s = await api<{ elementTh: string; tagline: string; traits: string[] }>(
        "/api/bazi/element-summary",
        { method: "POST", json: { person: { birthDate, birthTime, gender } } },
      );
      setSummary(s);
      setStep(2);
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === 0)
    return (
      <div className="screen center">
        <div className="logo">✦</div>
        <h1>Mumate</h1>
        <p className="muted">ความสงบเริ่มต้นที่ใจ สรรสร้างสมดุลแห่งชีวิต</p>
        <button className="primary" onClick={() => setStep(1)}>เริ่มต้น</button>
      </div>
    );

  if (step === 1)
    return (
      <div className="screen">
        <h2>วันนี้คุณอยากเน้นดูแลด้านไหน?</h2>
        <div className="chips">
          {FOCUS_OPTIONS.map(([k, label]) => (
            <button
              key={k}
              className={`chip ${focus.includes(k) ? "on" : ""}`}
              onClick={() => setFocus((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]))}
            >
              {label}
            </button>
          ))}
        </div>
        <h2>ข้อมูลของคุณ</h2>
        <label>วันเกิด <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></label>
        <label>เวลาเกิด <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} /></label>
        <label>เพศ
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="female">หญิง</option>
            <option value="male">ชาย</option>
            <option value="unspecified">ไม่ระบุ</option>
          </select>
        </label>
        <button className="primary" disabled={busy || !birthDate} onClick={submitBirth}>
          {busy ? "กำลังคำนวณ…" : "ถัดไป"}
        </button>
      </div>
    );

  return (
    <div className="screen center">
      <div className="logo">☯</div>
      <h1>ธาตุของคุณคือ {summary?.elementTh}</h1>
      <p className="muted">{summary?.tagline}</p>
      <div className="card left">
        <b>ลักษณะเด่นของคุณ</b>
        {(summary?.traits ?? []).map((t, i) => (
          <p key={i} className="small">✅ {t}</p>
        ))}
      </div>
      <button className="primary" onClick={() => onDone({ birthDate, birthTime, gender })}>
        ไปที่ดวงของฉัน
      </button>
    </div>
  );
}

// ── Tab: Home ────────────────────────────────────────────────────────────────
type HomeData = {
  fortune: { percent: number | null; verdict: string; summary: string; dayGanzhi: string } | null;
  manifest: { goals: { id: string; title: string; percent: number; affirmation: string | null }[]; streak: { current: number; best: number }; todayEntryDone: boolean };
  wallet: { coins: number; xp: number; level: number; nextLevelXp: number };
  missions: { done: number; total: number };
  intent: string[];
};

function HomeTab({ anonId, birth }: { anonId: string; birth: Birth }) {
  const [data, setData] = useState<HomeData | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<HomeData>("/api/home", { method: "POST", json: { anonId, person: birth } })
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, [anonId, birth]);

  if (err) return <p className="error">{err}</p>;
  if (!data) return <p className="muted">กำลังโหลด…</p>;
  const f = data.fortune;
  return (
    <div>
      <div className="row">
        <span className="pill">🪙 {data.wallet.coins}</span>
        <span className="pill">⭐ L{data.wallet.level} · {data.wallet.xp}/{data.wallet.nextLevelXp} XP</span>
        <span className="pill">🔥 {data.manifest.streak.current} วัน</span>
      </div>
      {f ? (
        <div className="card hero">
          <div className="big">{f.percent ?? "-"}%</div>
          <b>{VERDICT_TH[f.verdict] ?? f.verdict}</b>
          <p className="small">เสาวัน {f.dayGanzhi}</p>
          <p className="small muted">{f.summary}</p>
        </div>
      ) : null}
      <div className="card">
        <b>🎯 เป้าหมายของคุณ</b>
        {data.manifest.goals.length === 0 ? <p className="muted small">ยังไม่มี — ไปที่แท็บแมนิเฟสต์</p> : null}
        {data.manifest.goals.map((g) => (
          <div key={g.id} className="goal-row">
            <span>{g.title}</span>
            <div className="bar"><div style={{ width: `${g.percent}%` }} /></div>
            <span className="small">{g.percent}%</span>
          </div>
        ))}
      </div>
      <div className="card row between">
        <span>📋 ภารกิจวันนี้ {data.missions.done}/{data.missions.total}</span>
        <span>{data.manifest.todayEntryDone ? "✅ บันทึกแล้ว" : "✏️ ยังไม่ได้บันทึก"}</span>
      </div>
    </div>
  );
}

// ── Tab: Manifest ────────────────────────────────────────────────────────────
type Goal = {
  id: string;
  title: string;
  affirmation: string | null;
  progress: { done: number; target: number; percent: number };
  tasks: { id: string; title: string; targetCount: number; doneCount: number }[];
};

function ManifestTab({ anonId }: { anonId: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [affirmation, setAffirmation] = useState("");
  const [mood, setMood] = useState(0);
  const [note, setNote] = useState("");
  const [streak, setStreak] = useState<{ current: number; best: number } | null>(null);
  const [insight, setInsight] = useState<{ quote?: string; insights?: string[]; encouragement?: string } | null>(null);
  const [busy, setBusy] = useState("");

  const reload = useCallback(() => {
    api<{ goals: Goal[] }>(`/api/manifest/goals?anonId=${anonId}`).then((r) => setGoals(r.goals)).catch(() => {});
  }, [anonId]);
  useEffect(reload, [reload]);

  const createGoal = async () => {
    if (!title.trim()) return;
    setBusy("goal");
    try {
      await api("/api/manifest/goals", {
        method: "POST",
        json: { anonId, title, affirmation: affirmation || undefined, tasks: [{ title: "ลงมือทำวันนี้", targetCount: 7 }] },
      });
      setTitle(""); setAffirmation("");
      reload();
    } catch (e) { alert(String(e)); } finally { setBusy(""); }
  };

  const toggleTask = async (taskId: string, done: boolean) => {
    await api("/api/manifest/checkin", { method: "POST", json: { anonId, taskId, done } }).catch((e) => alert(String(e)));
    reload();
  };

  const saveEntry = async () => {
    setBusy("entry");
    try {
      const r = await api<{ rewarded: boolean; streak: { current: number; best: number } }>(
        "/api/manifest/entry",
        { method: "POST", json: { anonId, mood: mood || undefined, note: note || undefined } },
      );
      setStreak(r.streak);
      if (r.rewarded) alert("🪙 +10 เหรียญ +50 XP — บันทึกวันแรกของวันนี้!");
    } catch (e) { alert(String(e)); } finally { setBusy(""); }
  };

  const loadInsight = async () => {
    setBusy("insight");
    setInsight(null);
    try {
      setInsight(await api("/api/manifest/insights", { method: "POST", json: { anonId } }));
    } catch (e) { alert(String(e)); } finally { setBusy(""); }
  };

  return (
    <div>
      <div className="card">
        <b>วันนี้รู้สึกยังไง?</b>
        <div className="row">
          {MOODS.map((m, i) => (
            <button key={i} className={`mood ${mood === i + 1 ? "on" : ""}`} onClick={() => setMood(i + 1)}>{m}</button>
          ))}
        </div>
        <textarea placeholder="เพิ่มบันทึก…" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="primary" disabled={busy === "entry"} onClick={saveEntry}>บันทึกวันนี้</button>
        {streak ? <p className="small">🔥 ติดต่อกัน {streak.current} วัน (สถิติ {streak.best})</p> : null}
      </div>

      <div className="card">
        <b>🎯 เป้าหมาย ({goals.length}/5)</b>
        {goals.map((g) => (
          <div key={g.id} className="goal-block">
            <div className="row between">
              <b>{g.title}</b>
              <span className="small">{g.progress.percent}%</span>
            </div>
            {g.affirmation ? <p className="small muted">“{g.affirmation}”</p> : null}
            {g.tasks.map((t) => (
              <label key={t.id} className="task">
                <input type="checkbox" checked={t.doneCount >= t.targetCount} onChange={(e) => toggleTask(t.id, e.target.checked)} />
                {t.title} <span className="small muted">({t.doneCount}/{t.targetCount})</span>
              </label>
            ))}
          </div>
        ))}
        <input placeholder="เป้าหมายใหม่ เช่น เปิดร้านกาแฟ" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="affirmation เช่น ฉันมีเงิน 1,000,000" value={affirmation} onChange={(e) => setAffirmation(e.target.value)} />
        <button disabled={busy === "goal"} onClick={createGoal}>+ เพิ่มเป้าหมาย</button>
      </div>

      <div className="card">
        <div className="row between">
          <b>🧠 Behavior Insights (AI)</b>
          <button disabled={busy === "insight"} onClick={loadInsight}>{busy === "insight" ? "กำลังวิเคราะห์…" : "วิเคราะห์"}</button>
        </div>
        {insight ? (
          <>
            {insight.quote ? <p className="quote">“{insight.quote}”</p> : null}
            {(insight.insights ?? []).map((x, i) => <p key={i} className="small">💡 {x}</p>)}
            {insight.encouragement ? <p className="small muted">{insight.encouragement}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Tab: ดวง (matching + timeline) ──────────────────────────────────────────
function FortuneTab({ birth }: { birth: Birth }) {
  const [rel, setRel] = useState("love");
  const [bDate, setBDate] = useState("1994-07-07");
  const [bTime, setBTime] = useState("");
  const [match, setMatch] = useState<{
    overall: { percent: number | null; grade: string; gradeLabel: string; hearts: number; ratingText: string };
    dimensions: { key: string; label: string; percent: number | null; grade: string; isMain: boolean }[];
    note?: string | null;
  } | null>(null);
  const [timeline, setTimeline] = useState<{
    currentAge: number | null;
    stages: { startAge: number; endAge: number; ganzhi: string; isCurrent: boolean; overallGrade: number; domains: Record<string, string> }[];
  } | null>(null);
  const [busy, setBusy] = useState("");

  const runMatch = async () => {
    setBusy("match");
    try {
      setMatch(
        await api("/api/bazi/pair-match", {
          method: "POST",
          json: {
            relationship: rel,
            personA: { birthDate: birth.birthDate, birthTime: birth.birthTime, gender: birth.gender },
            personB: { birthDate: bDate, birthTime: bTime || undefined },
          },
        }),
      );
    } catch (e) { alert(String(e)); } finally { setBusy(""); }
  };

  const runTimeline = async () => {
    setBusy("timeline");
    try {
      setTimeline(await api("/api/bazi/life-timeline", { method: "POST", json: { person: birth } }));
    } catch (e) { alert(String(e)); } finally { setBusy(""); }
  };

  const reportUrl = useMemo(() => {
    const q = new URLSearchParams({ relationship: rel, aDate: birth.birthDate, aTime: birth.birthTime, bDate });
    if (bTime) q.set("bTime", bTime);
    return `/pair-match/report?${q}&print=1`;
  }, [rel, birth, bDate, bTime]);

  const LV: Record<string, string> = { high: "🟢 สูง", medium: "🟡 กลาง", low: "🔴 ต่ำ" };

  return (
    <div>
      <div className="card">
        <b>💞 ดวงสมพงษ์</b>
        <div className="chips">
          {[["love", "คู่รัก"], ["partner", "หุ้นส่วน"], ["boss", "เจ้านาย"], ["subordinate", "ลูกน้อง"], ["family", "ครอบครัว"]].map(([k, l]) => (
            <button key={k} className={`chip ${rel === k ? "on" : ""}`} onClick={() => setRel(k)}>{l}</button>
          ))}
        </div>
        <label>วันเกิดเขา <input type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} /></label>
        <label>เวลาเกิดเขา (ถ้าทราบ) <input type="time" value={bTime} onChange={(e) => setBTime(e.target.value)} /></label>
        <button className="primary" disabled={busy === "match"} onClick={runMatch}>{busy === "match" ? "กำลังคำนวณ…" : "จับคู่ดวง"}</button>
        {match ? (
          <div className="center">
            <div className="big">{match.overall.grade}</div>
            <b>{match.overall.percent ?? "-"}% · {match.overall.gradeLabel}</b>
            <div>{"❤️".repeat(match.overall.hearts)}{"🤍".repeat(5 - match.overall.hearts)}</div>
            <p className="small muted">{match.overall.ratingText}</p>
            {match.note ? <p className="small warn">⚠️ {match.note}</p> : null}
            {match.dimensions.map((dim) => (
              <div key={dim.key} className="goal-row">
                <span className="small">{dim.label}{dim.isMain ? " ⭐" : ""}</span>
                <div className="bar"><div style={{ width: `${dim.percent ?? 0}%` }} /></div>
                <span className="small">{dim.grade}</span>
              </div>
            ))}
            <a href={reportUrl} target="_blank" rel="noreferrer"><button>📄 บันทึกเป็น PDF</button></a>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="row between">
          <b>🌊 วัยจรชีวิต</b>
          <button disabled={busy === "timeline"} onClick={runTimeline}>{busy === "timeline" ? "…" : "ดู"}</button>
        </div>
        {timeline ? (
          <>
            <p className="small muted">อายุปัจจุบัน {timeline.currentAge ?? "-"} ปี</p>
            {timeline.stages.map((s) => (
              <div key={s.startAge} className={`stage ${s.isCurrent ? "cur" : ""}`}>
                <b>อายุ {s.startAge}-{s.endAge}</b> {s.ganzhi} {s.isCurrent ? "← ปัจจุบัน" : ""} · เกรด {s.overallGrade}
                <div className="small">งาน {LV[s.domains.career]} · เงิน {LV[s.domains.finance]} · รัก {LV[s.domains.love]}</div>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Tab: ภารกิจ ──────────────────────────────────────────────────────────────
function MissionTab({ anonId }: { anonId: string }) {
  const [missions, setMissions] = useState<{ id: string; title: string; description: string; count: number; target: number; rewardCoins: number; completed: boolean }[]>([]);
  const [karma, setKarma] = useState<{ wallet: { coins: number; xp: number; level: number; nextLevelXp: number }; stats: { missionsDone: number; activeDays: number; friendsInvited: number } } | null>(null);
  const [badges, setBadges] = useState<{ id: string; title: string; description: string; unlocked: boolean }[]>([]);

  const reload = useCallback(() => {
    api<{ missions: typeof missions }>(`/api/missions?anonId=${anonId}`).then((r) => setMissions(r.missions)).catch(() => {});
    api<NonNullable<typeof karma>>(`/api/karma?anonId=${anonId}`).then(setKarma).catch(() => {});
    api<{ badges: typeof badges }>(`/api/achievements?anonId=${anonId}`).then((r) => setBadges(r.badges)).catch(() => {});
  }, [anonId]);
  useEffect(reload, [reload]);

  const doMission = async (id: string) => {
    const r = await api<{ rewarded: boolean }>("/api/missions", { method: "POST", json: { anonId, missionId: id } });
    if (r.rewarded) alert("🎉 ภารกิจสำเร็จ ได้รับรางวัลแล้ว!");
    reload();
  };

  return (
    <div>
      {karma ? (
        <div className="card hero">
          <div className="big">🪙 {karma.wallet.coins}</div>
          <b>Level {karma.wallet.level} · {karma.wallet.xp}/{karma.wallet.nextLevelXp} XP</b>
          <p className="small">✅ {karma.stats.missionsDone} ภารกิจ · 📅 {karma.stats.activeDays} วัน · 👥 {karma.stats.friendsInvited} เพื่อน</p>
        </div>
      ) : null}
      <div className="card">
        <b>📋 ภารกิจ</b>
        {missions.map((mi) => (
          <div key={mi.id} className="goal-block">
            <div className="row between">
              <span>{mi.title} <span className="pill small">+{mi.rewardCoins}</span></span>
              {mi.completed ? <span>✅</span> : <button onClick={() => doMission(mi.id)}>ทำ</button>}
            </div>
            <div className="bar"><div style={{ width: `${(mi.count / mi.target) * 100}%` }} /></div>
            <span className="small muted">{mi.count}/{mi.target} — {mi.description}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <b>🏅 เหรียญรางวัล</b>
        <div className="chips">
          {badges.map((b) => (
            <span key={b.id} className={`chip ${b.unlocked ? "on" : "off"}`} title={b.description}>
              {b.unlocked ? "🏅" : "🔒"} {b.title}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: ฉัน (wallet + referral) ─────────────────────────────────────────────
function ProfileTab({ anonId }: { anonId: string }) {
  const [wallet, setWallet] = useState<{ coins: number; xp: number; level: number; history: { reason: string; coinDelta: number; xpDelta: number; createdAt: string }[] } | null>(null);
  const [referral, setReferral] = useState<{ code: string; inviteUrl: string; invitedCount: number } | null>(null);
  const [redeemCode, setRedeemCode] = useState("");

  const reload = useCallback(() => {
    api<NonNullable<typeof wallet>>(`/api/wallet?anonId=${anonId}&history=10`).then(setWallet).catch(() => {});
    api<NonNullable<typeof referral>>(`/api/referral?anonId=${anonId}`).then(setReferral).catch(() => {});
  }, [anonId]);
  useEffect(reload, [reload]);

  const redeem = async () => {
    try {
      await api("/api/referral", { method: "POST", json: { anonId, code: redeemCode.trim().toUpperCase() } });
      alert("🎉 รับ +100 เหรียญ +50 XP!");
      setRedeemCode("");
      reload();
    } catch (e) { alert(String(e)); }
  };

  return (
    <div>
      <div className="card center">
        <p className="small muted">anonId: {anonId}</p>
        {wallet ? <div className="big">🪙 {wallet.coins} · ⭐ L{wallet.level}</div> : null}
      </div>
      {referral ? (
        <div className="card center">
          <b>แนะนำเพื่อน</b>
          <div className="big">{referral.code}</div>
          <p className="small muted">{referral.inviteUrl} · เชิญแล้ว {referral.invitedCount} คน (+250/คน)</p>
          <div className="row">
            <input placeholder="กรอกโค้ดเพื่อน MUMATE###" value={redeemCode} onChange={(e) => setRedeemCode(e.target.value)} />
            <button onClick={redeem}>ใช้โค้ด</button>
          </div>
        </div>
      ) : null}
      <div className="card">
        <b>ประวัติแต้มล่าสุด</b>
        {(wallet?.history ?? []).map((h, i) => (
          <div key={i} className="row between small">
            <span>{h.reason}</span>
            <span>{h.coinDelta >= 0 ? "+" : ""}{h.coinDelta}🪙 {h.xpDelta >= 0 ? "+" : ""}{h.xpDelta}xp</span>
          </div>
        ))}
      </div>
      <button className="danger" onClick={() => { localStorage.clear(); location.reload(); }}>
        🔄 ล้างข้อมูลเดโม (เริ่มใหม่)
      </button>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
const TABS = [
  ["home", "🏠", "หน้าแรก"],
  ["manifest", "✨", "แมนิเฟสต์"],
  ["fortune", "☯️", "ดวง"],
  ["missions", "📋", "ภารกิจ"],
  ["me", "👤", "ฉัน"],
] as const;

export default function MvpPage() {
  const anonId = useAnonId();
  const [birth, saveBirth] = useBirth();
  const [tab, setTab] = useState<string>("home");

  return (
    <div className="phone-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="phone">
        <div className="phone-body">
          {!anonId ? (
            <p className="muted">…</p>
          ) : !birth ? (
            <Onboarding anonId={anonId} onDone={saveBirth} />
          ) : (
            <>
              {tab === "home" && <HomeTab anonId={anonId} birth={birth} />}
              {tab === "manifest" && <ManifestTab anonId={anonId} />}
              {tab === "fortune" && <FortuneTab birth={birth} />}
              {tab === "missions" && <MissionTab anonId={anonId} />}
              {tab === "me" && <ProfileTab anonId={anonId} />}
            </>
          )}
        </div>
        {birth ? (
          <nav className="bottom-nav">
            {TABS.map(([k, icon, label]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                <span>{icon}</span>
                <small>{label}</small>
              </button>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

// โทเคนทั้งหมดอิง DESIGN.md (root) — แก้สี/ฟอนต์ให้แก้ที่ :root ตรงนี้ + DESIGN.md คู่กัน
const CSS = `
.phone-wrap{
  --primary:#1B9AAF;--primary-dark:#15808F;--accent:#F4C430;--accent-soft:#FEF3C7;
  --background:#FAF7F2;--surface:#FFFFFF;--surface-alt:#F1ECE2;--ink:#1F1A17;--muted:#8A8377;
  --border:#E5DED2;--dark-card:#1F2430;--love:#E0245E;--warning:#8A6D3B;--danger:#C0392B;
  --radius-card:16px;--radius-card-lg:24px;--radius-input:10px;
  --font:'Noto Sans Thai','IBM Plex Sans Thai',system-ui,sans-serif;
}
.phone-wrap{min-height:100vh;background:#E8E4DC;display:flex;justify-content:center;padding:16px;font-family:var(--font);color:var(--ink)}
.phone{width:100%;max-width:420px;background:var(--background);border-radius:var(--radius-card-lg);box-shadow:0 8px 40px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden;min-height:calc(100vh - 32px)}
.phone-body{flex:1;overflow-y:auto;padding:16px}
.bottom-nav{display:flex;border-top:1px solid var(--border);background:var(--surface)}
.bottom-nav button{flex:1;padding:8px 0;border:none;background:none;color:var(--muted);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px}
.bottom-nav button.on{color:var(--primary);font-weight:700}
.screen{display:flex;flex-direction:column;gap:12px;padding:8px}
.center{text-align:center;align-items:center}
.left{text-align:left}
.logo{font-size:48px;margin:24px auto 0;color:var(--primary)}
h1{font-size:1.5rem;font-weight:700;margin:4px 0}h2{font-size:1.05rem;font-weight:700;margin:8px 0 2px}
.muted{color:var(--muted)}.small{font-size:.82rem;margin:3px 0}.big{font-size:2.2rem;font-weight:800;color:var(--primary)}
.error{color:var(--danger)}.warn{color:var(--warning)}
.card{background:var(--surface);border-radius:var(--radius-card);padding:14px;margin:10px 0;box-shadow:0 1px 4px rgba(0,0,0,.06);display:flex;flex-direction:column;gap:6px}
.card.hero{background:linear-gradient(135deg,var(--accent-soft),var(--surface));text-align:center}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.row.between{justify-content:space-between}
.pill{background:var(--surface-alt);border-radius:999px;padding:3px 10px;font-size:.8rem}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--border);background:var(--surface);border-radius:999px;padding:6px 12px;cursor:pointer;font-size:.85rem;color:var(--ink)}
.chip.on{background:var(--primary);color:#fff;border-color:var(--primary)}
.chip.off{opacity:.55}
button{border:none;border-radius:var(--radius-input);padding:8px 14px;background:var(--surface-alt);cursor:pointer;font-family:inherit;color:var(--ink)}
button.primary{background:var(--primary);color:#fff;font-weight:700;padding:12px;border-radius:999px;font-size:1rem}
button.primary:hover{background:var(--primary-dark)}
button.danger{background:#FBEAEA;color:var(--danger);width:100%;margin-top:8px}
button:disabled{opacity:.5}
input,select,textarea{border:1px solid var(--border);border-radius:var(--radius-input);padding:8px 10px;font-family:inherit;font-size:.9rem;width:100%;box-sizing:border-box;background:var(--surface);color:var(--ink)}
label{display:flex;flex-direction:column;gap:4px;font-size:.85rem;color:var(--muted)}
textarea{min-height:56px}
.mood{font-size:1.5rem;background:none;padding:4px;border-radius:50%}
.mood.on{background:var(--accent-soft);outline:2px solid var(--accent)}
.goal-row{display:grid;grid-template-columns:1fr 90px auto;gap:8px;align-items:center;margin:4px 0}
.bar{height:8px;background:var(--surface-alt);border-radius:999px;overflow:hidden}
.bar>div{height:100%;background:var(--primary);border-radius:999px}
.goal-block{border-top:1px dashed var(--border);padding-top:8px;margin-top:6px;display:flex;flex-direction:column;gap:4px}
.task{display:flex;flex-direction:row!important;align-items:center;gap:8px}
.task input{width:auto}
.quote{font-style:italic;color:var(--primary);font-weight:600}
.stage{border-left:3px solid var(--border);padding:6px 10px;margin:6px 0;font-size:.88rem}
.stage.cur{border-color:var(--primary);background:#EEFAFC;border-radius:0 var(--radius-input) var(--radius-input) 0}
`;
