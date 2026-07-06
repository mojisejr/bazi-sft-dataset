/**
 * Sacred Map — ค่าคงที่ + zod schema ที่ใช้ร่วมกันทั้งฝั่ง client และ server.
 * ธาตุอ้างอิง SupportedElementSchema เดิม (wood/fire/earth/metal/water).
 */
import { z } from "zod";

import type { SupportedElementValue } from "@/lib/bazi/schema-types";

export const SACRED_STATUSES = ["pending", "verified", "rejected"] as const;
export type SacredStatus = (typeof SACRED_STATUSES)[number];

export const SACRED_ELEMENTS: SupportedElementValue[] = [
  "wood",
  "fire",
  "earth",
  "metal",
  "water",
];

/** สีประจำธาตุ (ใช้กับ pin บนแผนที่ + ป้ายกรอง) */
export const ELEMENT_COLOR: Record<SupportedElementValue, string> = {
  wood: "#22c55e",
  fire: "#ef4444",
  earth: "#eab308",
  metal: "#94a3b8",
  water: "#3b82f6",
};

export const ELEMENT_LABEL_TH: Record<SupportedElementValue, string> = {
  wood: "ไม้",
  fire: "ไฟ",
  earth: "ดิน",
  metal: "ทอง",
  water: "น้ำ",
};

/** ความต้องการที่ใช้กรอง — ล้อกับ Intent Check ตอน onboarding */
export const NEED_OPTIONS = ["การงาน", "เงิน", "รัก", "สุขภาพ", "โชคลาภ", "จิตใจ"] as const;

export const DIRECTION_OPTIONS = [
  "ทิศเหนือ",
  "ทิศตะวันออกเฉียงเหนือ",
  "ทิศตะวันออก",
  "ทิศตะวันออกเฉียงใต้",
  "ทิศใต้",
  "ทิศตะวันตกเฉียงใต้",
  "ทิศตะวันตก",
  "ทิศตะวันตกเฉียงเหนือ",
] as const;

/** ลิงก์เปิด Google Maps — ใช้ googleMapUrl ที่กรอกไว้ก่อน ไม่งั้นสร้างจากพิกัด */
export function googleMapsLink(loc: {
  lat: number;
  lng: number;
  googleMapUrl?: string | null;
  name?: string | null;
}): string {
  if (loc.googleMapUrl && loc.googleMapUrl.trim()) return loc.googleMapUrl.trim();
  const q = encodeURIComponent(`${loc.name ?? ""} ${loc.lat},${loc.lng}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function isSupportedElement(value: unknown): value is SupportedElementValue {
  return typeof value === "string" && (SACRED_ELEMENTS as string[]).includes(value);
}

/** ป้าย + สีของธาตุ (คืน null ถ้าไม่มี/ไม่รู้จัก) */
export function elementMeta(value: string | null | undefined) {
  if (!isSupportedElement(value)) return null;
  return { key: value, label: ELEMENT_LABEL_TH[value], color: ELEMENT_COLOR[value] };
}

/** payload ที่แอดมินส่งมาสร้าง/แก้สถานที่ */
export const SacredLocationInputSchema = z.object({
  name: z.string().trim().min(1, "ต้องมีชื่อสถานที่").max(200),
  deity: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  province: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  direction: z.string().trim().max(60).optional().nullable(),
  rasiUpper: z.string().trim().max(60).optional().nullable(),
  rasiLower: z.string().trim().max(60).optional().nullable(),
  element: z.enum(["wood", "fire", "earth", "metal", "water"]).optional().nullable(),
  needs: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  worshipGuide: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().url("ลิงก์รูปไม่ถูกต้อง").max(1000).optional().nullable().or(z.literal("")),
  googleMapUrl: z.string().trim().url("ลิงก์แผนที่ไม่ถูกต้อง").max(1000).optional().nullable().or(z.literal("")),
});

export type SacredLocationInput = z.infer<typeof SacredLocationInputSchema>;

/** payload ที่ผู้ใช้ทั่วไปเสนอสถานที่ (subset + ช่องติดต่อ) */
export const SacredSubmissionSchema = SacredLocationInputSchema.extend({
  submitterContact: z.string().trim().max(200).optional().nullable(),
});

export type SacredSubmissionInput = z.infer<typeof SacredSubmissionSchema>;

/** รูปแบบสถานที่ที่ API ส่งกลับ (client-safe — date เป็น string) */
export interface SacredLocationDto {
  id: string;
  name: string;
  deity: string | null;
  description: string | null;
  province: string | null;
  address: string | null;
  lat: number;
  lng: number;
  direction: string | null;
  rasiUpper: string | null;
  rasiLower: string | null;
  element: string | null;
  needs: string[];
  worshipGuide: string | null;
  imageUrl: string | null;
  googleMapUrl: string | null;
  checkinCount: number;
  status: SacredStatus;
  source: string;
  submitterContact: string | null;
  createdAt: string;
  updatedAt: string | null;
}
