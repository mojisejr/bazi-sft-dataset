import Link from "next/link";

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
    href: "/what-if",
    icon: "🌀",
    kicker: "แคมเปญไวรัล",
    title: "What If...? โลกคู่ขนาน",
    description:
      "ถ้าวันนั้นเลือกเดินตามดวงชะตา ชีวิตจะเป็นยังไง? กรอกวันเกิด+อาชีพ เปิดประตูมิติดูตัวคุณอีกเวอร์ชัน พร้อมภาพ AI และการ์ดแชร์",
    cta: "เปิดประตูมิติ",
    featured: true,
  },
  {
    href: "/mvp",
    icon: "✨",
    kicker: "Mumate UI ใหม่",
    title: "หน้าเดโม MVP",
    description:
      "หน้าเดโม UI ใหม่ตามดีไซน์ Mumate — จับคู่ดวง รายงานดวง ไทม์ไลน์ชีวิต และสรุปธาตุ",
    cta: "เปิดหน้าเดโม",
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
    href: "/phone-reading",
    icon: "📱",
    kicker: "เลขพยากรณ์",
    title: "ทำนายชีวิตด้วยเบอร์มือถือ",
    description: "ใส่เบอร์มือถือ อ่านคำทำนายจากคู่เลขที่ติดกันตามตำราเลขพยากรณ์ ครูเอก",
    cta: "ทำนายเบอร์",
  },
  {
    href: "/divine-cards",
    icon: "🎴",
    kicker: "โหมดเซียน",
    title: "ไพ่จิตวิญญาณแดนสวรรค์",
    description:
      "จั่วหรือเลือกเอง 3 ใบ ทำนายตามหลักน้ำหนัก 50/30/20 ตอบด้วย engine ก่อน แล้วเกลาคำด้วย LLM ได้",
    cta: "เปิดโหมดเซียน",
  },
  {
    href: "/oracle-cards",
    icon: "🔮",
    kicker: "ไพ่ออราเคิล",
    title: "ไพ่ออราเคิลเคี้ยงคุง",
    description:
      "จั่วหรือเลือกเอง 3 ใบ จากสำรับ 120 ใบ ทำนายตามหลักน้ำหนัก 50/30/20 ตอบด้วย engine ก่อน แล้วเกลาคำด้วย LLM ได้",
    cta: "เปิดไพ่ออราเคิล",
  },
  {
    href: "/fortune-sage",
    icon: "🎋",
    kicker: "เสี่ยงทาย",
    title: "เซียนเสี่ยงทาย",
    description:
      "เสี่ยงทายสไตล์เซียมซี — สุ่ม 1 ใน 60 หัวเซี่ยงแซ แล้วตอบคำทำนายตามหัวที่ได้",
    cta: "เริ่มเสี่ยงทาย",
  },
  {
    href: "/honeycomb",
    icon: "🐝",
    kicker: "เบอร์ปิรามิด",
    title: "เบอร์รังผึ้ง",
    description:
      "สร้างสามเหลี่ยมปาสคาลจากเบอร์มือถือ อ่านพลังงานรายชั้น 11 ชั้น (ตัวเรา/คนใกล้ตัว/คนห่างตัว) แล้วเรียบเรียงด้วย AI ได้",
    cta: "เปิดเบอร์รังผึ้ง",
  },
  {
    href: "/almanac",
    icon: "📅",
    kicker: "ดิถีรายวัน",
    title: "ปฏิทินโหราศาสตร์",
    description:
      "ดูดิถีรายวัน เสาวัน/เดือน/ปี + เทพ สีมงคล ทิศ เลือกได้ทุกปี อดีต/อนาคต และโหลดเป็น Excel",
    cta: "เปิดปฏิทินโหรา",
  },
  {
    href: "/man-vs-day",
    icon: "🗓️",
    kicker: "ดวงกับวัน",
    title: "เทียบดวงกับเสาวันปฏิทิน",
    description:
      "เลือกดวงแล้วเทียบกับเสาวันของแต่ละวันในปฏิทิน ดูวันเสริม/วันปะทะ พร้อมพิมพ์เป็นปฏิทินรายปีได้",
    cta: "เปิดดวงกับวัน",
  },
  {
    href: "/sacred-map",
    icon: "🗺️",
    kicker: "สถานที่มู",
    title: "แผนที่มู / ไหว้เทพ",
    description:
      "ค้นหาสถานที่มู ไหว้เทพ ขอพรบนแผนที่ เสนอสถานที่ใหม่ เช็คอิน และแชร์ต่อได้",
    cta: "เปิดแผนที่มู",
  },
  {
    href: "/almanac/yam",
    icon: "⏱️",
    kicker: "ยามรายวัน",
    title: "ตรวจยาม",
    description: "ดูยามมงคล/ยามร้ายรายวัน เลือกฤกษ์ยามในแต่ละช่วงเวลาได้",
    cta: "เปิดตรวจยาม",
  },
  {
    href: "/rectify-hour",
    icon: "🕰️",
    kicker: "สอบยามเกิด",
    title: "สอบยาม (หายามเกิด)",
    description: "ไม่รู้เวลาเกิด? ตอบคำถามสั้น ๆ ให้ระบบช่วยประเมินยามเกิดที่น่าจะเป็น",
    cta: "เริ่มสอบยาม",
  },
  {
    href: "/reading/history",
    icon: "🗂️",
    kicker: "บันทึกย้อนหลัง",
    title: "ประวัติดวง",
    description: "เปิดดวงที่บันทึกไว้ กลับมาแก้ต่อ ปริ้นซ้ำ หรือฝากให้คนอื่นช่วยดูต่อได้",
    cta: "ดูประวัติดวง",
  },
  {
    href: "/reading/knowledge",
    icon: "📚",
    kicker: "องค์ความรู้ + คำแก้",
    title: "องค์ความรู้รายบท",
    description: "ดูหลักการ/แหล่งอ้างอิงที่ engine ใช้แต่ละบท และจัดการกฎแทนคำ (เปลี่ยนคำเดิม → คำใหม่)",
    cta: "ดูองค์ความรู้",
  },
  {
    href: "/reading/newdata-reading",
    icon: "📖",
    kicker: "คำทำนายจาก NewData",
    title: "อ่าน 15 บท (ข้อมูลใหม่)",
    description:
      "กรอกวันเกิด คำนวณดวงด้วย engine เดิม แต่ดึงคำทำนายจากข้อมูลใหม่ที่ซินแสแก้ได้ บันทึกดวงและพิมพ์ PDF ได้",
    cta: "เริ่มอ่าน 15 บท",
  },
  {
    href: "/reading/newdata-reading2",
    icon: "💗",
    kicker: "คำทำนายจาก NewData",
    title: "อ่าน 15 บท (Louise Hay)",
    description:
      "ข้อมูลเดิมทั้ง 15 บท แต่ให้ AI โค้ชฮีลใจ (Louise Hay) เล่าด้วยน้ำเสียงอบอุ่นให้กำลังใจ — ล้อโครงจากคำอ่านจริงซินแส 3 ดวง แก้รายบทแล้วพิมพ์ PDF ได้",
    cta: "เริ่มอ่าน 15 บท (Louise Hay)",
  },
  {
    href: "/reading/newdata",
    icon: "🗃️",
    kicker: "คลังคำทำนาย",
    title: "ข้อมูลใหม่ (NewData)",
    description: "จัดการคลังคำทำนายพื้นฐานที่ใช้ในการอ่าน 15 บท เพิ่ม/แก้/ลบรายกลุ่มได้ทันที",
    cta: "จัดการข้อมูลใหม่",
  },
  {
    href: "/reading/matching",
    icon: "💞",
    kicker: "คลังคำทำนายจับคู่",
    title: "ข้อมูล Matching",
    description: "จัดการคำทำนายหน้าจับคู่/สมพงษ์ (นิสัย/บทบาทเจ้านาย-ลูกน้อง-หุ้นส่วน-คู่รัก/สี่ซิ้ง) แก้ได้ทันที",
    cta: "จัดการคำทำนายจับคู่",
  },
  {
    href: "/reading/sacred-map",
    icon: "🗺️",
    kicker: "คลังสถานที่มู",
    title: "ข้อมูล Sacred Map",
    description: "แอดมินจัดการหมุดสถานที่มู/ไหว้เทพ เพิ่ม/แก้/ลบ อนุมัติที่ผู้ใช้เสนอเข้ามาได้",
    cta: "จัดการ Sacred Map",
  },
  {
    href: "/louise-hay",
    icon: "💗",
    kicker: "โค้ชฮีลใจ",
    title: "แชทรักและเยียวยาตัวเอง (Louise Hay)",
    description: "แชทให้กำลังใจน้ำเสียง Louise Hay + เลือกศาสตร์ตอบให้อัตโนมัติ (อ่านดวงใหม่ / ปฏิทิน / จั่วไพ่)",
    cta: "เปิดโค้ชฮีลใจ",
  },
  {
    href: "/stats",
    icon: "📊",
    kicker: "สถิติ & ต้นทุน",
    title: "สถิติ & ต้นทุน API (ทุกฟีเจอร์)",
    description: "โทเคนและค่า API ที่ใช้จริงต่อการเรียก LLM รวมทุกฟีเจอร์ (อ่านดวง · ไพ่ · โค้ชฮีลใจ · สร้างรูป) พร้อมกราฟ",
    cta: "เปิดแดชบอร์ดสถิติ",
  },
];

export function BaziTrainerWorkspace() {
  return (
    <main className="trainer-page">
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
