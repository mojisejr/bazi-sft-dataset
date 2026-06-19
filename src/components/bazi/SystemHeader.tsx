"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { StatusCopy } from "@/lib/bazi/trainer-workspace";

type SystemHeaderProps = {
  /** คงไว้เพื่อความเข้ากันได้กับหน้าเดิม — ไม่ถูกแสดงผลแล้ว */
  statusCopy?: StatusCopy;
  /** ซ่อนแถบนำทางด่วน (เช่น หน้าหลักที่มีการ์ดเมนูอยู่แล้ว) */
  showNav?: boolean;
  /** คงไว้เพื่อความเข้ากันได้ — ป้ายสถานะถูกถอดออกแล้ว */
  showStatus?: boolean;
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
  { href: "/almanac/yam", icon: "⏱️", label: "ตรวจยาม" },
  { href: "/reading/history", icon: "🗂️", label: "ประวัติดวง" },
  { href: "/reading/knowledge", icon: "📚", label: "องค์ความรู้" },
];

function isActiveLink(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SystemHeader({ showNav = true }: SystemHeaderProps) {
  const pathname = usePathname();

  if (!showNav) return null;

  return (
    <nav className="header-nav header-nav--bar" aria-label="เมนูนำทางด่วน">
      {NAV_LINKS.map((link) => {
        const active = isActiveLink(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`header-nav__link${active ? " header-nav__link--active" : ""}`}
            aria-current={active ? "page" : undefined}
            title={link.label}
          >
            <span className="header-nav__icon" aria-hidden="true">
              {link.icon}
            </span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
