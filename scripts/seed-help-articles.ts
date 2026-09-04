/**
 * Seed บทความช่วยเหลือ (help-faq / document-reader) — idempotent (INSERT เมื่อ slug ยังไม่มี).
 * ใช้: node --env-file=.env --import tsx scripts/seed-help-articles.ts
 */
import postgres from "postgres";

const url = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error("APP_DATABASE_URL or DATABASE_URL is required.");
const sql = postgres(url, { prepare: false, max: 1, ssl: url.includes("localhost") ? false : "require" });

const ARTICLES: Array<{ slug: string; title: string; body: string; position: number }> = [
  {
    slug: "what-is-qi",
    title: "ชี่ (Qi Token) คืออะไร ใช้ทำอะไรได้บ้าง",
    body: [
      "ชี่คือพลังงานสะสมภายในแอป ใช้เปิดการ์ด/เสี่ยงทาย ถาม AI เพิ่ม ขยายช่องจับคู่สมพงษ์ และปลดล็อคเนื้อหาเจาะลึกต่าง ๆ",
      "",
      "วิธีสะสมชี่:",
      "• เช็คอินรายวัน +5 ชี่ (วันละครั้ง)",
      "• แชร์คอนเทนต์ +10 ชี่ (วันละครั้ง)",
      "• ชวนเพื่อนสมัครผ่านโค้ด +50 ชี่ ต่อคน",
      "• ทำภารกิจได้เหรียญ/XP และโบนัสตามเงื่อนไข",
      "",
      "ซื้อเพิ่มได้ที่หน้า “เติมชี่” (แพ็ก 200/500/1,200 ชี่) — เติมครั้งแรกรับโบนัส +30 ชี่",
    ].join("\n"),
    position: 1,
  },
  {
    slug: "birth-edit-rules",
    title: "แก้วันเกิด — กติกาสิทธิ์ฟรี 1 ครั้ง และการใช้ชี่",
    body: [
      "วันเกิดเปลี่ยน ดวงเปลี่ยนทั้งหมด เราจึงให้แก้ได้ “ฟรี 1 ครั้งตลอดชีพ”",
      "",
      "• ครั้งแรก: ฟรี (แค่กดยืนยัน)",
      "• ครั้งถัดไป: ใช้ 100 ชี่ ต่อการแก้",
      "• ถ้าไม่จำเวลาเกิด ให้ติ๊ก “ไม่ทราบเวลาเกิด” — ระบบจะไม่ใช้เสายามในการอ่านดวง",
      "",
      "ถ้าพบว่าระบบบันทึกวันเกิดไม่ตรง หรือมีเหตุพิเศษ ใช้ปุ่ม “ขอให้ทีมช่วยพิจารณา” ที่หน้าแก้วันเกิดได้เสมอ",
    ].join("\n"),
    position: 2,
  },
  {
    slug: "referral-how-to",
    title: "ชวนเพื่อน — โค้ดแนะนำและโบนัสคู่",
    body: [
      "หน้า “ชวนเพื่อน” มีโค้ดส่วนตัวของคุณ (รูปแบบ MUMATE+เลข 3 หลัก)",
      "",
      "• เพื่อนสมัครผ่านลิงก์/โค้ดของคุณ: เพื่อนได้ +100 เหรียญ คุณได้ +250 เหรียญ และ +50 ชี่",
      "• ชวนเพื่อนอัปเกรดแพ็กเกจ PLUS ได้เพิ่ม +500 ชี่ / PRO ได้ +1,000 ชี่",
      "• โค้ดใช้ได้คนละ 1 ครั้งตลอดชีพ และใช้โค้ดตัวเองไม่ได้",
    ].join("\n"),
    position: 3,
  },
  {
    slug: "privacy-and-deletion",
    title: "ความเป็นส่วนตัว (PDPA) และการลบบัญชี",
    body: [
      "ข้อมูลที่เราเก็บใช้เพื่อคำนวณดวงและให้บริการในแอปเท่านั้น",
      "",
      "• ดูนโยบายฉบับเต็มได้ที่ “นโยบายความเป็นส่วนตัว”",
      "• ส่งออกข้อมูลของคุณเป็นไฟล์ JSON ได้ที่ “ส่งออกข้อมูลของฉัน”",
      "• ลบบัญชี: ระบบจะ “พักบัญชี 30 วัน” ก่อนลบถาวร — ภายใน 30 วันนี้กดยกเลิกได้ทันทีและข้อมูลกลับมาตามเดิม",
    ].join("\n"),
    position: 4,
  },
  {
    slug: "payments",
    title: "การชำระเงิน ใบเสร็จ และแพ็กเกจ",
    body: [
      "ชำระผ่านบัตรเครดิต/เดบิต หรือพร้อมเพย์ QR (ปลอดภัยตามมาตรฐานสากล)",
      "",
      "• ประวัติคำสั่งซื้อและใบเสร็จดูได้ที่ “ประวัติคำสั่งซื้อ”",
      "• ใบกำกับภาษีฉบับเต็มส่งไปที่อีเมลหลังชำระเงินสำเร็จ",
      "• ชี่เข้าอัตโนมัติทันทีที่ระบบยืนยันการชำระเงิน",
    ].join("\n"),
    position: 5,
  },
];

async function main() {
  let inserted = 0;
  for (const a of ARTICLES) {
    const rows = await sql`
      INSERT INTO bazi_help_article (slug, title, body, position)
      SELECT ${a.slug}, ${a.title}, ${a.body}, ${a.position}
      WHERE NOT EXISTS (SELECT 1 FROM bazi_help_article WHERE slug = ${a.slug})
      RETURNING slug`;
    if (rows.length) inserted += 1;
  }
  const all = await sql`select slug, title from bazi_help_article order by position`;
  console.log(`inserted ${inserted}, total ${all.length}:`);
  for (const a of all) console.log(` - ${a.slug}: ${a.title}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
