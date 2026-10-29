// /kiang-kung — โหราศาสตร์เคี้ยงคุง (ซินแสนุ้ย 2026-10-29 · layer 1): เลือกเส้นทางแห่งคำพยากรณ์
import Link from "next/link";

import { SystemHeader } from "@/components/bazi/SystemHeader";

const PATHS = [
  { title: "ประตูฟ้า ชะตาดิน", sub: "ทุกคำถามที่คุณอยากรู้ เมื่อฟ้าเปิด ดินรับรู้ — เก้าประตู เปิดชะตา", href: "/kiang-kung/nine-gates", live: true },
  { title: "เซียมซี ไพ่เคี้ยงคุงออราเคิล", sub: "ตั้งคำถามและเปิดรับคำแนะนำจากไพ่ 3 ใบ", href: "/oracle-cards", live: true },
  { title: "ถามตอบเรื่องฮวงจุ้ย", sub: "ค้นหาคำแนะนำเรื่องบ้านและสภาพแวดล้อม", href: null, live: false },
  { title: "พยากรณ์ จับยามสามตา", sub: "พิจารณาเหตุการณ์ผ่านช่วงเวลาและสัญลักษณ์", href: null, live: false },
] as const;

export default function KiangKungHubPage() {
  return (
    <main className="page-shell">
      <SystemHeader statusCopy={{ tone: "ready", label: "โหราศาสตร์เคี้ยงคุง", detail: "ศูนย์รวมศาสตร์แห่งการพยากรณ์" }} />
      <section style={{ background: "#1c1014", color: "#f3e6d3", borderRadius: 20, padding: 24 }} data-testid="kiang-kung-hub">
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ color: "#e3c27e", fontSize: 12, letterSpacing: 2 }}>เลือกเส้นทางแห่งคำพยากรณ์</div>
          <h1 style={{ margin: "6px 0", fontSize: 30 }}>วันนี้ คุณต้องการทำอะไร</h1>
          <p style={{ color: "#bfa98f", margin: 0 }}>เลือกหัวข้อที่ต้องการ เพื่อเข้าสู่ศาสตร์และคำแนะนำที่เหมาะกับคำถามของคุณ</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
          {PATHS.map((p) => {
            const body = (
              <div style={{ border: "1px solid rgba(214,180,120,0.35)", borderRadius: 16, padding: 18, background: p.live ? "#f6ead2" : "#efe6d6", color: "#2a171d", opacity: p.live ? 1 : 0.65, height: "100%" }}>
                <span style={{ fontSize: 11, background: p.live ? "#7a3b2e" : "#b9a88a", color: "#fff", borderRadius: 999, padding: "2px 10px" }}>{p.live ? "เปิดใช้งาน" : "เตรียมเปิด"}</span>
                <h2 style={{ margin: "10px 0 4px", fontSize: 20 }}>{p.title}</h2>
                <p style={{ margin: 0, color: "#6b5340" }}>{p.sub}</p>
                {p.live ? <div style={{ textAlign: "right", fontSize: 20, marginTop: 6 }}>→</div> : null}
              </div>
            );
            return p.href ? (
              <Link key={p.title} href={p.href} style={{ textDecoration: "none" }}>{body}</Link>
            ) : (
              <div key={p.title}>{body}</div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
