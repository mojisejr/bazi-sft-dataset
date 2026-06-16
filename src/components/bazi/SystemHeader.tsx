"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { StatusChip } from "@/components/bazi/primitives/StatusChip";
import { Surface } from "@/components/bazi/primitives/Surface";
import type { StatusCopy } from "@/lib/bazi/trainer-workspace";

type SystemHeaderProps = {
  statusCopy: StatusCopy;
  /** ซ่อนแถบนำทางด่วน (เช่น หน้าหลักที่มีการ์ดเมนูอยู่แล้ว) */
  showNav?: boolean;
};

type NavLink = {
  href: string;
  icon: string;
  label: string;
};

const NAV_LINKS: NavLink[] = [
  { href: "/", icon: "🏠", label: "หน้าหลัก" },
  { href: "/reading", icon: "🔮", label: "อ่านดวง" },
  { href: "/pair-matching", icon: "💞", label: "คู่รัก" },
  { href: "/work-matching", icon: "🤝", label: "การงาน" },
  { href: "/phone-reading", icon: "📱", label: "เบอร์มือถือ" },
  { href: "/divine-cards", icon: "🎴", label: "โหมดเซียน" },
  { href: "/fortune-sage", icon: "🎋", label: "เซียนเสี่ยงทาย" },
  { href: "/honeycomb", icon: "🐝", label: "เบอร์รังผึ้ง" },
  { href: "/almanac", icon: "📅", label: "ปฏิทินโหรา" },
  { href: "/reading/history", icon: "🗂️", label: "ประวัติดวง" },
  { href: "/reading/knowledge", icon: "📚", label: "องค์ความรู้" },
];

function isActiveLink(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SystemHeader({ statusCopy, showNav = true }: SystemHeaderProps) {
  const pathname = usePathname();

  return (
    <Surface as="section" className="trainer-header">
      <div className="brand-lockup">
        <p className="brand-mark">Bazi Trainer</p>
        <h1>Bazi Trainer that makes ซินแส ซินแส !</h1>
        <p className="brand-story">
          พื้นที่ทำงานที่พาเรื่องยากให้ไหลลื่น ตั้งข้อมูลให้ชัด คำนวณให้ตรง แล้วอ่านภาพรวมได้ทันที
          แบบเรียบง่ายแต่มั่นคง
        </p>
      </div>

      <div className="header-sidebar">
        <div className="status-stack">
          <StatusChip tone={statusCopy.tone}>{statusCopy.label}</StatusChip>
          <p className="status-detail">{statusCopy.detail}</p>
        </div>

        {showNav ? (
          <nav className="header-nav" aria-label="เมนูนำทางด่วน">
            {NAV_LINKS.map((link) => {
              const active = isActiveLink(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`header-nav__link${active ? " header-nav__link--active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="header-nav__icon" aria-hidden="true">
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
    </Surface>
  );
}
