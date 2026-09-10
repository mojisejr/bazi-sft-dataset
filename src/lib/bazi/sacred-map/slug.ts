// slug สำหรับลิงก์แชร์สาธารณะ /p/<slug>
// ไทย→โรมันอัตโนมัติไม่แม่นพอ → ที่จริง 7 แห่งใช้ slug คัดมือ (CURATED); ที่ผู้ใช้เสนอใหม่ใช้ ascii ในชื่อ
// (เช่นชื่ออังกฤษ) ถ้าไม่ได้ → fallback place-<hex> (แอดมินปรับ slug สวยทีหลังได้)

/** slug คัดมือของสถานที่ตั้งต้น (คีย์ = substring ของชื่อ ให้ทนต่อการแก้ชื่อเล็กน้อย) */
export const CURATED_SLUGS: { match: string; slug: string }[] = [
  { match: "เจ้าพ่อเสือ", slug: "chaopho-suea" },
  { match: "กวนอิม", slug: "kuan-im-thian-fa" },
  { match: "จิ๋นเซ่ง", slug: "rongje-chin-seng-tua" },
  { match: "พรหมเอราวัณ", slug: "phra-phrom-erawan" },
  { match: "หลักเมือง", slug: "lak-mueang-bangkok" },
  { match: "มังกรกมลาวาส", slug: "wat-mangkon" },
  { match: "ตรีมูรติ", slug: "trimurti-centralworld" },
]

/** ascii-slugify: เก็บ a-z0-9 จากชื่อ (ดีสำหรับชื่ออังกฤษ/ผสม) — คืน "" ถ้าไม่มี ascii */
export function asciiSlugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/** slug ตั้งต้นจากชื่อ: curated ก่อน → ascii → "" (ให้ caller เติม suffix กันชน/fallback) */
export function baseSlugFor(name: string): string {
  const hit = CURATED_SLUGS.find((c) => name.includes(c.match))
  if (hit) return hit.slug
  return asciiSlugify(name)
}
