// bdash โครงที่ทุกเมนูใช้ร่วม (mumate-bdash-v2-001 slice 2): หัวหน้า, แถบช่วงเวลา, เมนู 5 หน้า
// (มือถือ = แถบล่าง, คอม = แท็บบน) — ช่วงที่เลือกอยู่ในลิงก์ของทุกเมนู. ไม่มี JavaScript ฝั่งเครื่อง.
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { doorOf } from "@/lib/backstage/gate";
import { todayBangkok } from "@/lib/bazi/manifest/dates";
import { RangeTooHeavyError } from "@/lib/bdash/live";
import { EARLIEST, parseRange, PRESETS, withRange, type BdashRange } from "@/lib/bdash/range";
import { thRange } from "@/lib/bdash/view";

import mascot from "./mascot.png";

import "../bdash.css";

export const bdashMetadata: Metadata = { title: "MuMate ภาพรวมธุรกิจ", robots: { index: false, follow: false } };

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** เปิดได้เฉพาะผ่านประตู bdash / หลังบ้าน (production) แล้วอ่านช่วงจากลิงก์ */
export async function openBdash(searchParams: SearchParams): Promise<BdashRange> {
  const h = await headers();
  if (!doorOf(h) && process.env.NODE_ENV === "production") notFound();
  return parseRange(await searchParams, todayBangkok());
}

export type MenuKey = "overview" | "stay" | "money" | "features" | "chat";

export const MENUS: ReadonlyArray<{ key: MenuKey; path: string; label: string; question: string; icon: string }> = [
  { key: "overview", path: "/bdash", label: "ภาพรวม", question: "ธุรกิจเป็นอย่างไร และอะไรเปลี่ยน", icon: "home" },
  { key: "stay", path: "/bdash/stay", label: "อยู่ต่อไหม", question: "คนที่สมัครเข้ามา กลับมาใช้อีกไหม และยอมจ่ายเงินไหม", icon: "loop" },
  { key: "money", path: "/bdash/money", label: "เงินเข้า", question: "กดจ่ายแล้วติดตรงไหน ใครจ่าย และกลับมาซื้ออีกไหม", icon: "coin" },
  { key: "features", path: "/bdash/features", label: "ฟีเจอร์และ AI", question: "คนใช้ฟีเจอร์ไหน คุ้มค่า AI ไหม และแจก QI มากไปไหม", icon: "grid" },
  { key: "chat", path: "/bdash/chat", label: "แชตถามอะไร", question: "คนสนใจเรื่องไหน ถามเรื่องวันนี้หรือทั้งปี", icon: "chat" },
];

export const menu = (key: MenuKey) => MENUS.find((m) => m.key === key)!;

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  loop: (
    <>
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5" />
      <path d="M12 6.5v1.5M12 16v1.5" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
      <path d="M9 11h.01M12 11h.01M15 11h.01" />
    </>
  ),
};

export function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const hhmm = (at: number) => new Date(at).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });

/** ทั้งหน้า: หัว + แถบช่วง + เมนู + เนื้อหา */
export function BdashShell(props: { active: MenuKey; range: BdashRange; at: number | null; children: React.ReactNode }) {
  const { active, range } = props;
  const m = menu(active);
  return (
    <div className="bd-page">
      <div className="bd">
        <div className="bd-top">
          <div className="bd-brand">
            {/* mascot จาก mootech-fe (public/images/v2/mascot/01-nav.png ครอปหัว-ไหล่) · import เป็นไฟล์ static จึงมาทาง /_next/
                ที่ประตู bdash และ Caddy เปิดอยู่แล้ว (owner 2026-10-21, slice 3) */}
            {/* eslint-disable-next-line @next/next/no-img-element -- รูปเล็ก 44px ไฟล์เดียว ไม่ต้องผ่านตัวย่อรูป */}
            <img className="bd-logo" src={mascot.src} width={44} height={44} alt="" aria-hidden="true" />
            <div>
              <h1>ภาพรวมธุรกิจ MuMate</h1>
              <p>สำหรับทีม business · อ่านอย่างเดียว</p>
            </div>
          </div>
          <div className="bd-chips">
            <span className="bd-chip">
              <span className="dot" />
              {props.at ? (
                <>
                  ข้อมูล ณ <span className="num">{hhmm(props.at)}</span> น. · อัปเดตทุก 10 นาที
                </>
              ) : (
                <>อ่านสดจากฐานข้อมูล</>
              )}
            </span>
          </div>
        </div>

        <div className="bd-bar">
          <RangeBar path={m.path} range={range} />
          <nav className="bd-nav" aria-label="เมนู">
            {MENUS.map((x) => (
              <a key={x.key} href={withRange(x.path, range)} aria-current={x.key === active ? "page" : undefined}>
                <Icon name={x.icon} />
                <span>{x.label}</span>
              </a>
            ))}
          </nav>
        </div>

        {active !== "overview" ? (
          <header className="bd-head">
            <h2>{m.label}</h2>
            <p>{m.question}</p>
          </header>
        ) : null}

        {props.children}
      </div>
    </div>
  );
}

function RangeBar({ path, range }: { path: string; range: BdashRange }) {
  const today = todayBangkok();
  return (
    <div className="bd-range">
      <span className="lbl">ดูช่วง</span>
      <div className="bd-seg">
        {PRESETS.map((n) => (
          <a key={n} href={`${path}?range=${n}`} aria-current={range.key === `${n}` ? "true" : undefined}>
            {n} วัน
          </a>
        ))}
        <details className="bd-custom">
          <summary aria-current={range.key === "custom" ? "true" : undefined}>เลือกเอง</summary>
          <form method="get" action={path} className="bd-custom-form">
            <label>
              ตั้งแต่
              <input type="date" name="from" min={EARLIEST} max={today} defaultValue={range.from} required />
            </label>
            <label>
              ถึง
              <input type="date" name="to" min={EARLIEST} max={today} defaultValue={range.to} required />
            </label>
            <button type="submit">ดู</button>
          </form>
        </details>
      </div>
      <span className="bd-dates num">{thRange(range.from, range.to)}</span>
      {range.note ? <p className="bd-note">{range.note}</p> : null}
    </div>
  );
}

/** ผลของการอ่านสด หรือ null ถ้าช่วงหนักเกินเวลาที่กันไว้ (หน้าแสดง TooHeavy แทน) */
export async function readOrHeavy<T>(load: Promise<{ value: T; at: number }>): Promise<{ value: T; at: number } | null> {
  try {
    return await load;
  } catch (e) {
    if (e instanceof RangeTooHeavyError) return null;
    throw e;
  }
}

/** หน้าที่อ่านไม่ทันเวลาที่กันไว้ */
export function TooHeavy({ range }: { range: BdashRange }) {
  return (
    <p className="bd-empty">
      ช่วง {thRange(range.from, range.to)} ({range.days} วัน) ยาวเกินกว่าจะอ่านสดได้ทันเวลา เพื่อไม่ให้แอปของสมาชิกช้าลง ลองเลือกช่วงที่สั้นลง
    </p>
  );
}

/** บนมือถือแต่ละรายการโชว์ 5 แถวแรก (แถวที่เหลือใส่ class "bd-extra") แล้วมีปุ่มนี้ "ดูทั้งหมด" — บนคอมโชว์ครบ ไม่มีปุ่ม */
export const SHOW_FIRST = 5;
export const extra = (i: number): string | undefined => (i >= SHOW_FIRST ? "bd-extra" : undefined);

export function ShowAll({ id, total, label }: { id: string; total: number; label: (rest: number) => string }) {
  if (total <= SHOW_FIRST) return null;
  return (
    <>
      <input type="checkbox" id={id} className="bd-showall" />
      <label htmlFor={id} className="bd-more">
        {label(total - SHOW_FIRST)}
      </label>
    </>
  );
}

export function Kpi(props: { icon: string; label: string; big: string; unit?: string; dir: string; href?: string; go?: string; children: React.ReactNode }) {
  return (
    <div className="bd-kpi">
      <div className="head">
        <span className="bd-ico">
          <Icon name={props.icon} />
        </span>
        <span className="label">{props.label}</span>
      </div>
      <span className="big">
        {props.big}
        {props.unit ? <span className="unit">{props.unit}</span> : null}
      </span>
      <span className="sub">{props.children}</span>
      <span className="bd-dir">{props.dir}</span>
      {props.href ? (
        <a className="bd-go" href={props.href}>
          ดูต่อที่ {props.go} ›
        </a>
      ) : null}
    </div>
  );
}
