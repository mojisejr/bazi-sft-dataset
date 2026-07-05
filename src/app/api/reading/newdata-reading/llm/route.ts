/**
 * POST /api/reading/newdata-reading/llm — "โหมดถอดแบบซินแส" (Gemini)
 *
 * แปลงคำอ่านตั้งต้นจาก NewData (แหล่งอ้างอิงหลักที่ซินแสดูแลที่ /reading/newdata) ให้เป็น
 * คำอ่านสไตล์ซินแส "รายกล่อง" โดยเลียนจากตัวอย่างจริง (few-shot) + กฎ 8 ข้อ
 *
 * สำคัญ: NewData คือแกนเนื้อหา (ground truth) — ซินแสเพิ่มข้อมูลใหม่เมื่อไหร่ โหมดนี้ยึดอันนั้นก่อน
 * few-shot สอนแค่ "สำนวน/วิธีเรียบเรียง" (~80%) ห้ามลอกข้อเท็จจริงข้ามดวง
 * ใช้ generateProseLlm (ไม่ผ่านด่าน marker เข้ม) แล้วคืน box-markdown ให้ client parse เป็นกล่อง
 */
import { generateProseLlm, READING_TOPIC_PROMPTS } from "@/lib/bazi/reading-llm";
import { getChapterOutline } from "@/lib/bazi/chapter-outline";
import fewshotBank from "@/lib/bazi/shinse-fewshot.generated.json";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

export const runtime = "nodejs";

type ReadingBox = { title?: string; body?: string; templatePrefill?: boolean };
type FewshotExample = { dayElement: string; engine: string; shinse: string };
const BANK = fewshotBank as Record<string, FewshotExample[]>;

type LlmRequestBody = {
  topicId?: string;
  rawInput?: RawInputValue;
  calculatedState?: CalculatedStateValue;
  boxes?: ReadingBox[];
  anonId?: string | null;
  /** compose = เขียน/เสริมสไตล์ซินแส (default) · refine = เกลาสำนวนอย่างเดียว คงเนื้อ ไม่เติม */
  mode?: "compose" | "refine";
};

/** กล่อง → box-markdown แบบ "ดิบ" (body ว่างคงว่าง ไม่ใส่ GEN_MARK) — ใช้ตอนโหมด refine */
function boxesPlain(boxes: ReadingBox[]): string {
  return (boxes || [])
    .map((b) => `[[box=${b.title ?? ""}]]\n${(b.body ?? "").trim()}\n[[/box]]`)
    .join("\n");
}

/** system instruction โหมด refine — เกลาสำนวน คงเนื้อทุกอย่าง ห้ามเติม */
const REFINE_SYSTEM = [
  "คุณคือบรรณาธิการที่ \"เกลาสำนวน\" คำอ่านโหราศาสตร์ให้ลื่นและอ่านง่าย โดยคงเนื้อหาเดิมทุกอย่าง (นี่ไม่ใช่การเขียนใหม่)",
  "กฎเหล็ก:",
  "- คงข้อเท็จจริง/ข้อสรุป/ธาตุ/เชี่ยงแซ/ตัวเลข/ทุกรายการในลิสต์ เดิมครบ — ห้ามเพิ่มการตีความ/ประเด็น/ตัวอย่าง/ย่อหน้าใหม่ ห้ามขยายความ ความยาวต้องใกล้เคียงของเดิม (ไม่ยืด)",
  "- แก้ได้แค่: ทำสำนวนให้ลื่น, ตัดคำซ้ำ/ศัพท์เทคนิคดิบ (พลังงาน:/อุปนิสัย:/สูตรผสม), แก้คำสะกดผิด, จัดย่อหน้าให้อ่านง่าย",
  "- อักษรจีนน้อยแบบรายงาน: เก็บเฉพาะดิถี ที่เหลือเล่าเป็นไทย (เชี่ยงแซชื่อไทย, ราศีล่างเป็นนักษัตรได้)",
  "- คงหัวข้อกล่อง [[box=...]] เดิม (ตามจำนวน/ลำดับเดิม) กล่องว่างคงว่าง",
  "รูปแบบตอบ: กล่อง [[box=หัวข้อ]] เนื้อ [[/box]] เดิมที่เกลาแล้ว ไม่มีคำอธิบายอื่น ไม่มี JSON",
].join("\n");

const STEM_ELEMENT: Record<string, string> = {
  "甲": "ไม้", "乙": "ไม้", "丙": "ไฟ", "丁": "ไฟ", "戊": "ดิน",
  "己": "ดิน", "庚": "ทอง", "辛": "ทอง", "壬": "น้ำ", "癸": "น้ำ",
};

/** เครื่องหมายบอกว่ากล่องนี้ยังไม่มีข้อมูล (ซินแสยังไม่เติมใน NewData) → ให้ AI เขียนเองจากข้อเท็จจริงดวง */
const GEN_MARK = "⟨ยังไม่มีข้อมูล — เขียนคำอ่านของหัวข้อนี้เองจากข้อเท็จจริงดวงด้านล่าง⟩";

/** กล่อง → box-markdown [[box=หัวข้อ]] เนื้อ [[/box]] (รูปแบบเดียวกับ few-shot + ที่ client parse)
 *  กล่อง body ว่าง → ใส่ GEN_MARK ให้ AI รู้ว่าต้อง "เขียนเอง" (ไม่ใช่ "ขัดเกลา") */
function boxesToMarkdown(boxes: ReadingBox[]): string {
  return (boxes || [])
    .map((b) => {
      const body = (b.body ?? "").trim();
      // body ว่าง หรือ กล่อง template generic (ยังไม่ curate) → ให้ AI เขียนเอง
      const needGenerate = !body || b.templatePrefill;
      return `[[box=${b.title ?? ""}]]\n${needGenerate ? GEN_MARK : body}\n[[/box]]`;
    })
    .join("\n");
}

/** เลือกตัวอย่าง ≤2 อัน — เอาธาตุตรงดวงนี้ก่อน แล้วเติมธาตุอื่น (กระจายสำนวน) */
function pickFewshot(topicId: string, dayElement: string): FewshotExample[] {
  const pool = BANK[topicId] ?? [];
  if (pool.length === 0) return [];
  const same = pool.find((e) => e.dayElement === dayElement);
  const others = pool.filter((e) => e !== same);
  return [same, others[0]].filter(Boolean) as FewshotExample[];
}

const SYSTEM_MOVES = [
  "คุณคือซินแสมืออาชีพที่เขียนรายงานพยากรณ์ \"Your Life Code\" ให้ลูกค้าอ่าน",
  "งานของคุณมี 2 แบบต่อกล่อง: (ก) กล่องที่มีเนื้อ = \"ขัดเกลา\" ให้เป็นสำนวนซินแส (ข) กล่องที่เนื้อเป็น \"⟨ยังไม่มีข้อมูล…⟩\" = \"เขียนคำอ่านหัวข้อนั้นเอง\" โดยอิงข้อเท็จจริงจากดวง (ดิถี/กำลัง/สี่เสา ที่ให้ด้านล่าง) + หลักโหราศาสตร์จีน ในสไตล์ซินแส — ถ้าดวงนี้ไม่มีองค์ประกอบของหัวข้อนั้นจริง (เช่นไม่มีคู่ธาตุในดวง) ให้บอกสั้น ๆ ว่าไม่เด่น/ไม่มี ห้ามแต่งเสาหรือธาตุที่ไม่มีในสี่เสา",
  "เลียนแบบวิธีเรียบเรียงจากตัวอย่างจริงที่แนบมา และทำตามแนวทาง 8 ข้อ:",
  "1. คงโครง (หัวข้อกล่อง/ช่วงอายุ) แต่ \"ใช้อักษรจีนให้น้อยที่สุด แบบรายงานมืออาชีพที่อ่านง่าย\": เก็บอักษรจีนไว้เฉพาะ \"ดิถี\" (ก้านวัน เช่น 甲) พอเป็นหมุด — ที่เหลือเล่าเป็นภาษาไทย: เอ่ยเสาเป็น \"เสาปี/เสาเดือน/เสาวัน/เสายาม\" (ไม่ต้องมี ganzhi 庚午/丙寅/癸酉 กำกับ), เชี่ยงแซใช้ชื่อไทย (ซี่/ตี้อ๋วง/หมกยก), ราศีล่างแปลงเป็นนักษัตรไทยได้ (午=มะเมีย 酉=ระกา). ห้ามสาดอักษรจีนซ้ำทุกกล่อง — เป้าหมายคือ ~2-3 อักษรจีนต่อพันตัวอักษร เท่ารายงาน PDF จริง",
  "2. ตัด scaffolding เทคนิคออก: บรรทัดสูตรผสม (เช่น \"丙+辛=水 ...แปรสภาพเป็นธาตุน้ำ\"), ป้าย \"พลังงาน:/อุปนิสัย:\", แท็ก \"(จิตใต้สำนึก)/(เชี่ยงแซ)\" — ดึงเฉพาะเนื้อมาเรียบเรียงเป็นภาษาคนทั่วไป",
  "3. แก้คำสะกดผิดที่พบ (เช่น ฟิลม์→ฟิล์ม, บุคคิล→บุคลิก, โบรคเกอร์→โบรกเกอร์, สูงสุง→สูงสุด)",
  "4. แปลงนามธรรม → ตัวบุคคลจริง: จาก \"ธาตุไม้ที่เสาเดือน\" ให้บอกว่าเป็นใคร (พ่อ/แม่/ปู่ย่า/ครูอาจารย์/ผู้ใหญ่/เพศเดียวกับเจ้าชะตา) ตามความหมายของตำแหน่งเสา",
  "5. เปลี่ยนคำแนะนำ/สิ่งพึงระวังจากแบบ generic ให้เจาะจงเฉพาะดวงนี้ (ผูกกับจุดเด่น/ปัญหาจริงของดวง)",
  "6. ตัดสินดี-ร้ายตามบริบทช่วงชีวิต/วัย: วัยจรช่วงเด็ก=เรื่องเรียน/ครอบครัว, ช่วงทำงาน เชี่ยงแซดี=รุ่งเรือง มีคนหนุน — แปลความหมายเชี่ยงแซดิบให้เข้ากับวัยจริง",
  "7. ยุบกล่องที่ซ้ำ/ย่อยเกินให้กระชับ แต่คงหัวข้อหลักไว้",
  "8. ใส่ \"[[pagebreak]]\" เป็นบรรทัดคั่นระหว่างกล่อง เพื่อคุมการขึ้นหน้าใน PDF (ประมาณทุก 3-4 กล่อง/ช่วงอายุ)",
  "",
  "หลักคุณภาพ (สำคัญมาก — ทำให้ใกล้ซินแสจริง ไม่ใช่แค่ลื่น):",
  "ก. กลมกลืน อย่าขัดกันเอง: ถ้าดวงมีทั้งด้านแข็งและอ่อน ให้รวมเป็นบุคลิก \"คนคนเดียวที่มีมิติ\" แล้วอธิบายว่าแต่ละด้านออกในบริบทไหน (เช่น เด็ดขาดในงาน อ่อนโยนในสังคม) — ห้ามวางคำตรงข้าม (ผู้นำ vs ผู้ตาม / เด็ดขาด vs โลเล) คู่กันลอย ๆ จนอ่านแล้วย้อนแย้ง",
  "ข. คัดกรองตามดวง อย่าหว่านแห: บทสี/ทิศ/องค์เทพ/ของเสริม — เน้น \"ธาตุหลักที่ดวงต้องการ\" (ตัวแรกในลิสต์) ให้เด่นก่อน แล้วค่อยเสริมธาตุรองสั้น ๆ ห้ามนำเสนอทุกธาตุเท่ากันเป็นพรืด",
  "ค. คุมโทนให้สมดุล: ดิถีอ่อน/เชี่ยงแซเสีย = ชี้ \"แนวรับมือ/พัฒนา\" ไม่ใช่ตอกย้ำแต่ด้านร้าย · ไม่ลงรายละเอียดเชิงเทคนิคจนหนัก/สับสน — เขียนให้ลูกค้าทั่วไปอ่านแล้วรู้สึกดีและใช้ได้จริง",
  "ง. ร้อยเป็นเรื่อง ผูกกับดวง: อย่าลิสต์ข้อมูลดิบเรียงกัน — เชื่อมว่า \"ทำไมถึงเป็นแบบนี้กับดวงนี้\" (ผูกกับดิถี/กำลัง/เชี่ยงแซจริง) ให้อ่านเป็นเรื่องเดียวที่ไหลลื่น",
  "",
  "กฎเหล็ก (ห้ามผิด):",
  "- กล่องที่มีเนื้อ: เนื้อต้องมาจากคำอ่านตั้งต้น (NewData) เท่านั้น — ตัวอย่างซินแสใช้ดู \"สำนวน\" (~80%) ห้ามลอกข้อเท็จจริง/ธาตุ/ช่วงอายุ/ชื่อเสาจากตัวอย่าง หรือจากกล่องอื่น มายัดกล่องนี้",
  "- กล่อง ⟨ยังไม่มีข้อมูล⟩: เขียนได้เองแต่ต้องอิง \"สี่เสา/ดิถี/กำลัง ที่ให้\" เท่านั้น — ห้ามแต่งเสา/ธาตุ/เชี่ยงแซ/อายุ ที่ไม่มีในข้อมูลดวง และห้ามยกลิสต์ (อาชีพ/สี/องค์เทพ) ขึ้นมาเองถ้าไม่มีข้อมูล",
  "- ห้ามตัดข้อมูลลิสต์ (อาชีพ/วิชา/สี) ที่กล่องมีเนื้อให้มา",
  "- น้ำเสียงเป็นกลาง ไม่ลงท้าย \"ครับ/ค่ะ\" ไม่เอ่ยชื่อไฟล์/แหล่งข้อมูล",
  "",
  "รูปแบบคำตอบ: กล่องเรียงตามลำดับ แต่ละกล่องเขียน \"[[box=หัวข้อ]]\" ขึ้นบรรทัด ตามด้วยเนื้อ แล้วปิดด้วย \"[[/box]]\" — คั่นด้วย \"[[pagebreak]]\" ตามข้อ 8 ได้ ไม่ต้องมีคำอธิบายอื่น ไม่มี JSON ไม่มี ```",
].join("\n");

/**
 * แนวทางคุณภาพเฉพาะบท — เจาะบทที่ judge พบว่าอ่อน (ตีความขัด/เชิงลบ/บวกเกิน)
 * ฉีดเพิ่มเฉพาะ topicId ที่ระบุ ไม่กระทบบทอื่น
 */
const TOPIC_QUALITY_HINTS: Record<string, string> = {
  benefactor:
    "เน้น \"ผู้อุปถัมภ์หลัก\" (ธาตุส่งเสริม 印 = พ่อ/แม่/ปู่ย่า/ครูอาจารย์/ผู้ใหญ่/เจ้านาย) ให้เด่นก่อน แล้วค่อยเสริม คู่ธาตุ(เพื่อน/พี่น้อง/หุ้นส่วน)·บริวาร(ลูกน้อง)·ลูกค้า สั้น ๆ — รวมทุกเสาเป็น \"เครือข่ายคนหนุนที่สอดคล้องกัน\" ห้ามให้แต่ละเสาตีความขัดกันเอง",
  family:
    "เขียนถึง \"ความผูกพัน/บทบาทในครอบครัว\" (พ่อ=ราศีบนเสาเดือน, แม่=ราศีล่างเสาเดือน, ปู่ย่าตายาย=เสาปี) อย่างอบอุ่นเข้าใจได้ — แปลเชี่ยงแซเป็นลักษณะความสัมพันธ์/การดูแล ไม่ใช่ชะตากรรมดิบ (เชี่ยงแซ ซี่/เจ๊าะ ห้ามแปลตรง ๆ ว่า \"ตาย/ตัดขาด/หมดหวัง\" กับคนในบ้าน ให้เป็นเรื่องระยะห่าง/ต้องประคอง) คุมโทนกลาง-อบอุ่น ไม่ตอกย้ำด้านร้าย ไม่ลงรายละเอียดหนักเกิน",
  turning_points:
    "คง\"ดี-ร้าย\"ของแต่ละช่วงวัยตามเชี่ยงแซที่ให้ (เชี่ยงแซดี=ช่วงส่งเสริม, เชี่ยงแซเสีย=ช่วงเฝ้าระวัง) — ห้ามพลิกช่วงที่เชี่ยงแซเสียให้เป็นบวกเกินจริง และห้ามใส่ดีเกินทุกช่วง. เล่าให้เข้ากับวัยจริง (เด็ก=เรียน/ครอบครัว, วัยทำงาน=อาชีพ/การเงิน/ครอบครัว) กระชับต่อช่วง คงป้ายอายุ/ไอคอนดาวถ้ามี",
};

function buildUserPrompt(
  topicId: string,
  rawInput: RawInputValue,
  state: CalculatedStateValue,
  excerpt: string,
  examples: FewshotExample[],
): string {
  const prompt = READING_TOPIC_PROMPTS[topicId];
  const outline = getChapterOutline(topicId);
  const dm = state.dayMaster ?? "";
  const strength = state.dayMasterStrengthProfile?.displayLabel ?? "";
  const p = state.fourPillars;
  // ป้อน "เชี่ยงแซจริงที่ engine คำนวณต่อเสา" (lowerStagePrimary) ด้วย — กัน AI เดา/แต่งเชี่ยงแซเองตอน generate
  const pf = (
    pillar: { stem?: string | null; branch?: string | null; lowerStagePrimary?: string | null } | null | undefined,
    name: string,
  ) => {
    if (!pillar) return `${name} ?`;
    const gz = `${pillar.stem ?? ""}${pillar.branch ?? ""}`;
    const qi = pillar.lowerStagePrimary ? ` = เชี่ยงแซ "${pillar.lowerStagePrimary}"` : "";
    return `${name} ${gz}${qi}`;
  };
  const pillarLine = p
    ? [
        "สี่เสา + เชี่ยงแซจริงของดวงนี้ (สภาวะ 12 จังหวะเทียบดิถี — เป็นข้อเท็จจริงจาก engine ต้องใช้ค่านี้เท่านั้น):",
        `  ${pf(p.year, "เสาปี")} · ${pf(p.month, "เสาเดือน")} · ${pf(p.day, "เสาวัน[ดิถี]")} · ${pf(p.hour, "เสายาม")}`,
        "ตอนเขียนกล่องว่าง/template: ห้ามเดาหรือแต่งชื่อเชี่ยงแซ/สภาวะเอง ใช้เชี่ยงแซของเสาที่ระบุข้างบนเท่านั้น และอ้างอิงเฉพาะเสา/ธาตุที่มีจริง",
      ].join("\n")
    : "";
  return [
    `หัวข้อบท: ${prompt.heading}`,
    `สิ่งที่ต้องเน้น: ${prompt.focus}`,
    `ข้อมูลดวง: เกิด ${rawInput.birthDate} ${rawInput.birthTime} เพศ ${rawInput.gender} · ดิถี ${dm}${strength ? ` (${strength})` : ""}`,
    ...(pillarLine ? [pillarLine] : []),
    ...(prompt.preserveDetail ? ["", `ข้อควรรักษา: ${prompt.preserveDetail}`] : []),
    ...(TOPIC_QUALITY_HINTS[topicId] ? ["", `แนวทางเฉพาะบทนี้ (สำคัญ): ${TOPIC_QUALITY_HINTS[topicId]}`] : []),
    ...(outline
      ? ["", "หัวข้อย่อยที่ควรครอบคลุมตามลำดับ:", ...outline.bullets.map((b, i) => `  ${i + 1}. ${b}`)]
      : []),
    "",
    "════ คำอ่านตั้งต้น (NewData) ของดวงนี้ — แกนเนื้อหา ต้องคงข้อเท็จจริงครบ ════",
    excerpt,
    ...(examples.length
      ? [
          "",
          "════ ตัวอย่างวิธีที่ซินแสเรียบเรียง (ดู \"สำนวน/การจัดหัวข้อ\" เท่านั้น ห้ามลอกเนื้อ) ════",
          "(หมายเหตุ: ตัวอย่างเหล่านี้ยังมีอักษรจีนเยอะ — ให้ยึด \"วิธีเรียบเรียง\" แต่ลดอักษรจีนลงตามกฎ #1 ให้อ่านง่ายกว่าตัวอย่าง)",
          ...examples.flatMap((ex, i) => [
            `[ตัวอย่าง ${i + 1} — ดวงธาตุ${ex.dayElement}]`,
            "‹ตั้งต้น›",
            ex.engine,
            "‹ซินแสเรียบเรียงเป็น›",
            ex.shinse,
            "",
          ]),
        ]
      : []),
    "ตอบเป็นกล่อง [[box=...]]...[[/box]] ของ \"ดวงนี้\" ครบทุกกล่อง — กล่องมีเนื้อ=ขัดเกลาจากตั้งต้น, กล่อง ⟨ยังไม่มีข้อมูล⟩=เขียนเองจากสี่เสา/ดิถี — ทั้งหมดในสำนวนตามตัวอย่าง",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LlmRequestBody;
    const topicId = body.topicId;
    const prompt = topicId ? READING_TOPIC_PROMPTS[topicId] : undefined;

    if (!topicId || !prompt) {
      return Response.json({ error: "หัวข้อบทไม่ถูกต้อง" }, { status: 400 });
    }
    if (!body.rawInput || !body.calculatedState) {
      return Response.json({ error: "ต้องคำนวณดวงก่อนจึงจะทำนายด้วย AI ได้" }, { status: 400 });
    }
    const mode = body.mode === "refine" ? "refine" : "compose";
    // refine = เกลาสำนวนของกล่องเดิม (คงว่าง=ว่าง) · compose = เขียน/เสริม (กล่องว่าง→ generate)
    const excerpt = mode === "refine" ? boxesPlain(body.boxes ?? []) : boxesToMarkdown(body.boxes ?? []);
    if (!excerpt.trim()) {
      return Response.json({ error: "บทนี้ยังไม่มีคำทายจาก NewData ให้ AI เรียบเรียง" }, { status: 400 });
    }

    let systemInstruction: string;
    let userPrompt: string;
    if (mode === "refine") {
      systemInstruction = REFINE_SYSTEM;
      userPrompt = [
        `หัวข้อบท: ${prompt.heading}`,
        "เกลาสำนวนของกล่องต่อไปนี้ให้ลื่น อ่านง่าย คงเนื้อครบ ไม่เพิ่มเนื้อ ไม่ขยายความ:",
        "",
        excerpt,
      ].join("\n");
    } else {
      const dayElement = STEM_ELEMENT[body.calculatedState.dayMaster ?? ""] ?? "?";
      const examples = pickFewshot(topicId, dayElement);
      systemInstruction = SYSTEM_MOVES;
      userPrompt = buildUserPrompt(topicId, body.rawInput, body.calculatedState, excerpt, examples);
    }

    // retry สูงสุด 2 ครั้ง — Gemini คืนค่าว่างเป็นครั้งคราว (บางบท/บางดวง); รอบสองลด temperature
    let result: { text: string; model: string } | null = null;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try {
        const r = await generateProseLlm({
          systemInstruction,
          userPrompt,
          provider: "gemini",
          temperature: attempt === 0 ? 0.5 : 0.35,
          usageFeature: "reading_topic",
          usageLabel: `newdata:${topicId}`,
          usageAnonId: body.anonId ?? null,
        });
        if (r.text?.trim()) result = r;
      } catch {
        /* ว่าง/transient — ลองใหม่ */
      }
    }

    if (result) {
      return Response.json({ text: result.text, model: result.model }, { status: 200 });
    }
    // fallback: AI ล้มเหลว → คืนกล่อง NewData ดิบ (body จริง ไม่ใส่ GEN_MARK) ดีกว่าตอบ 500 — ผู้ใช้ได้เนื้อ NewData ไปก่อน
    const fallback = (body.boxes ?? [])
      .map((b) => `[[box=${b.title ?? ""}]]\n${(b.body ?? "").trim()}\n[[/box]]`)
      .join("\n");
    return Response.json({ text: fallback, model: "newdata-fallback" }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ทำนายด้วย AI ไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}
