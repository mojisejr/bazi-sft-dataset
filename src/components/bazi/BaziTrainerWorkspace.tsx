import Link from "next/link";

import { SystemHeader } from "@/components/bazi/SystemHeader";
import type { StatusCopy } from "@/lib/bazi/trainer-workspace";

const HUB_STATUS_COPY: StatusCopy = {
  tone: "ready",
  label: "เลือกเครื่องมือเพื่อเริ่มงาน",
  detail: "หน้าหลักเป็นจุดเริ่มต้น — เลือกการ์ดด้านล่างเพื่อเข้าสู่งานอ่านดวงหรือเปรียบเทียบดวงได้ทันที",
};

type HubCard = {
  href: string;
  icon: string;
  kicker: string;
  title: string;
  description: string;
  cta: string;
  /** การ์ดหลัก — กินเต็มแถวและเน้นสีบนจอกว้าง */
  featured?: boolean;
};

const HUB_CARDS: HubCard[] = [
  {
    href: "/reading",
    icon: "🔮",
    kicker: "คำทำนายเชิงลึก",
    title: "อ่านดวงทีละบท 15 หัวข้อ",
    description:
      "กรอกวันเกิด คำนวณดวง แล้วอ่านทีละหัวข้อจนครบทั้ง path พร้อมบันทึกประวัติและ export PDF / Word",
    cta: "เริ่มอ่านดวง",
    featured: true,
  },
  {
    href: "/pair-matching",
    icon: "💞",
    kicker: "คู่สมพงษ์",
    title: "เปรียบเทียบคู่รัก",
    description: "จับคู่ดวงสองคน ดูความเข้ากันของธาตุและจังหวะความสัมพันธ์",
    cta: "เปรียบเทียบคู่รัก",
  },
  {
    href: "/work-matching",
    icon: "🤝",
    kicker: "ทีมงาน",
    title: "เปรียบเทียบการงาน",
    description: "เทียบดวงทีมงานได้สูงสุด 3 คน หาบทบาทและการเสริมกันในการทำงาน",
    cta: "เปรียบเทียบการงาน",
  },
  {
    href: "/reading/history",
    icon: "🗂️",
    kicker: "บันทึกย้อนหลัง",
    title: "ประวัติดวง",
    description: "เปิดดวงที่บันทึกไว้ กลับมาแก้ต่อ ปริ้นซ้ำ หรือฝากให้คนอื่นช่วยดูต่อได้",
    cta: "ดูประวัติดวง",
  },
];

export function BaziTrainerWorkspace() {
  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={HUB_STATUS_COPY} />

      <nav className="reading-hub" aria-label="เมนูหลัก">
        {HUB_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`hub-card${card.featured ? " hub-card--featured" : ""}`}
          >
            <span className="hub-card__icon" aria-hidden="true">
              {card.icon}
            </span>
            <span className="hub-card__body">
              <span className="hub-card__kicker">{card.kicker}</span>
              <span className="hub-card__title">{card.title}</span>
              <span className="hub-card__description">{card.description}</span>
            </span>
            <span className="hub-card__cta">
              {card.cta}
              <span className="hub-card__cta-arrow" aria-hidden="true">
                →
              </span>
            </span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
