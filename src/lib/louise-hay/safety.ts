/**
 * ชั้นคัดกรองความปลอดภัย (Crisis Screening Gate) สำหรับแชท "โค้ชฮีลใจ".
 *
 * หลักการ (ตามแผน Mumate + ที่ทีมตกลง):
 * - คัดกรอง "ก่อน" ส่งข้อความเข้าโมเดลทุกครั้ง (route เรียก screenCrisis ก่อน Gemini)
 * - เกณฑ์เป็น deterministic (คำ/วลี) ที่ตรวจสอบได้ ไม่ให้ AI คิดเกณฑ์เอง → ป้องกันเชิงกฎหมาย
 * - เจอสัญญาณวิกฤต (RED) → หยุดบททันที ไม่ให้อวตาร/โมเดลรับมือเอง → คืนข้อความส่งต่อ + สายด่วน
 *
 * ระดับ AMBER (โทนทุกข์ใจ/ดิ่ง) ยังใช้ detectEmotionalDistress ใน persona.ts เหมือนเดิม
 * (เข้าโมเดลได้ แต่แนบคำสั่งห่วงใย) — ไฟล์นี้จัดการเฉพาะ RED (hard gate).
 *
 * server-only.
 */

// ════════════════════════════════════════════════════════════════════════════
// ⚠️⚠️  รอจิตแพทย์ / นักจิตวิทยา sign-off — แก้ได้เฉพาะ 2 ค่านี้  ⚠️⚠️
//
// CRISIS_PATTERNS และ CRISIS_RESPONSE ด้านล่างเป็น **STARTER** ที่เรียบเรียงจาก
// "สัญญาณเตือนการฆ่าตัวตาย" ของแหล่งสาธารณะไทย (กรมสุขภาพจิต / สสส. / มหิดล-RILCA /
// Bangkok Mental Health) เพื่อใช้ชั่วคราว — ยังไม่ใช่เกณฑ์สุดท้าย (production).
// อ้างอิง:
//   - สสส. "5 สัญญาณเตือน โพสต์อยากฆ่าตัวตาย" https://www.thaihealth.or.th
//   - RILCA มหิดล "7 สัญญาณเตือนการฆ่าตัวตาย" https://lc.mahidol.ac.th/research-matter/7signals/
//   - Bangkok Mental Health "สัญญาณเตือนฆ่าตัวตาย" https://bangkokmentalhealthhospital.com/th/warning-signs/
//
// เมื่อผู้เชี่ยวชาญ (จิตแพทย์/นักจิตวิทยาคลินิก) ตรวจและส่งลิสต์มาแล้ว
// ให้ "แทนค่า" ใน 2 ตัวแปรนี้ได้เลย — ไม่ต้องแก้ logic screenCrisis / route / UI.
//
// ต้องมีชื่อผู้เชี่ยวชาญรับผิดชอบก่อนเปิดใช้จริง (ตามแผน "ห้าม vibe-code ข้ามข้อนี้").
// หลักการ RED: sensitivity สูงไว้ก่อน (พลาดไปหยุดบท ปลอดภัยกว่าพลาดไม่หยุด) —
// ส่วนโทน "เหนื่อย/ท้อ/หมดไฟ" ทั่วไป เป็น AMBER (detectEmotionalDistress) ไม่ใช่ RED.
// ════════════════════════════════════════════════════════════════════════════

/** วลี/คำที่บ่งชี้ "ความตั้งใจ/แผนทำร้ายตัวเอง-จบชีวิต" (RED) — starter รอผู้เชี่ยวชาญตรวจ */
export const CRISIS_PATTERNS: readonly RegExp[] = [
  // — ความคิด/ความตั้งใจตรง ๆ —
  /อยากตาย/,
  /(อยาก|คิด|มีความคิด)(อยาก)?(ตาย|จบชีวิต|ฆ่าตัวตาย)/,
  /คิดสั้น/,
  /ไม่อยาก(มีชีวิต|อยู่)(อีก|แล้ว|ต่อ)?/,
  /อยาก(จบ|ปลิด)ชีวิต/,
  /จบชีวิต(ตัวเอง|ตัวฉัน)?/,
  /อยากให้(ทุกอย่าง|มัน)จบ(ๆ)?/,
  /ฆ่าตัวตาย/,
  // — วิธีการ/การลงมือ —
  /ทำร้าย(ตัวเอง|ร่างกายตัวเอง)/,
  /กรีด(ข้อมือ|แขน|ตัวเอง)/,
  /(กิน|กลืน)(ยา|สารเคมี|น้ำยา)(ตาย|ฆ่าตัวตาย|เยอะ ?ๆ)/,
  /(โดด|กระโดด)(ตึก|สะพาน|น้ำ)/,
  /(ผูกคอ|แขวนคอ|รมควัน)(ตาย)?/,
  /(เตรียม|สะสม|วางแผน).*(ตาย|ฆ่าตัวตาย|จบชีวิต)/,
  /เขียน(จดหมาย|โน้ต)(ลา|สั่งเสีย)/,
  // — สิ้นหวัง/รู้สึกเป็นภาระ/ไม่มีทางออก (สัญญาณเชิงคำพูดที่แหล่งอ้างอิงชี้) —
  /อยากหายไป(จากโลก|ตลอดกาล|ให้หมด|เลย)?/,
  /อยากนอน(หลับ)?(ยาว)?(แล้ว)?ไม่(ต้อง)?(ตื่น|ลืมตา)/,
  /ไม่มี(ความหมาย|เหตุผล)ที่จะอยู่(ต่อ)?/,
  /ไม่มีฉัน.{0,5}(ดีกว่า|สบายกว่า)/,
  /เป็นภาระ(ของ)?(ทุกคน|ครอบครัว|คนอื่น|สังคม)/,
  /(ไม่มีทางออก|หมดหนทาง|มืดมนไปหมด).*(ตาย|ไป|จบ|หายไป)/,
  /ทนไม่ไหวแล้ว.*(ตาย|ไป|หายไป|จบ)/,
];

/**
 * ข้อความตอบเมื่อพบสัญญาณวิกฤต (RED) — starter รอผู้เชี่ยวชาญตรวจ.
 * เรียบเรียงตามแนวปฏิบัติสายด่วน: (1) รับรู้/ไม่ตัดสิน (2) ไม่พยายามบำบัด-วินิจฉัยเอง
 * (3) เชื่อมกับความช่วยเหลือจริงชัดเจน (1323 สุขภาพจิต, 1669 ฉุกเฉิน)
 * (4) ชวน "ไม่อยู่คนเดียว" + บอกคนที่ไว้ใจ.
 */
export const CRISIS_RESPONSE = [
  "เราอ่านสิ่งที่คุณเขียนแล้ว และเป็นห่วงคุณจริง ๆ นะ ขอบคุณมากที่กล้าพูดออกมา สิ่งที่คุณรู้สึกอยู่มันหนักมากจริง ๆ และคุณไม่ควรต้องแบกมันอยู่คนเดียว 💗",
  "",
  "เรื่องแบบนี้หนักเกินกว่าจะให้เราคนเดียวช่วยได้ และเราอยากให้คุณได้คุยกับคนที่ดูแลได้จริงตอนนี้เลย:",
  "",
  "• สายด่วนสุขภาพจิต 1323 (โทรฟรี ตลอด 24 ชม.) — มีคนพร้อมรับฟังคุณ",
  "• เหตุฉุกเฉิน/หากไม่ปลอดภัยตอนนี้ โทร 1669",
  "",
  "ถ้ามีคนใกล้ตัวที่พอไว้ใจได้ ลองบอกเขาว่าตอนนี้คุณรู้สึกแบบนี้ อย่าเพิ่งอยู่คนเดียวนะ",
  "เราอยู่ตรงนี้กับคุณ และเราอยากให้คุณปลอดภัย คุณสำคัญมากจริง ๆ",
].join("\n");

export type CrisisScreenResult = {
  /** "red" = พบสัญญาณวิกฤต ต้องหยุดบท; "none" = ผ่าน */
  level: "red" | "none";
  /** สำหรับ log/audit เท่านั้น (รูปแบบ pattern ที่ match ไม่ใช่ข้อความผู้ใช้) */
  matched: string[];
};

/**
 * คัดกรองข้อความผู้ใช้หาสัญญาณวิกฤต (RED). deterministic ล้วน ไม่เรียก LLM.
 * หมายเหตุ: keyword/regex มี false-negative ได้ (พิมพ์อ้อม/สะกดเลี่ยง) — ในอนาคต
 * ควรเสริม LLM classifier เป็นชั้นสอง แต่ชั้นนี้ (deterministic) ต้องคงไว้เป็นด่านหลัก.
 */
export function screenCrisis(text: string): CrisisScreenResult {
  const matched: string[] = [];
  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(text)) {
      matched.push(pattern.source);
    }
  }
  return { level: matched.length > 0 ? "red" : "none", matched };
}

// ── ชั้นสอง: LLM classifier (belt-and-suspenders) ──
// จับเคสวิกฤตที่ "พิมพ์อ้อม/เลี่ยงคำ" ที่ regex พลาด. ใช้เป็นชั้นเสริม — ด่านหลักยังเป็น regex
// (deterministic ตรวจสอบได้). โมเดล lite ราคาถูก + prompt บังคับตอบ YES/NO อย่างเดียว.
const CRISIS_LLM_MODEL = "gemini-3.1-flash-lite";
// หมายเหตุ: prompt เป็นภาษาอังกฤษโดยตั้งใจ — โมเดล lite ตอบ YES/NO เสถียรกว่าภาษาไทย
// (prompt ไทยเคยทำให้คืนค่าว่าง). ตัวข้อความผู้ใช้ยังเป็นไทยได้ปกติ.
const CRISIS_LLM_PROMPT = [
  "You are a safety classifier for a Thai emotional-support chat.",
  "Decide if the user's message indicates thoughts, intent, or a plan of self-harm or suicide",
  "(including indirect signals: wanting to disappear, not wanting to wake up, feeling like a burden,",
  "being better off dead, or no reason to keep living).",
  "Answer with ONE word only: YES if there is such risk, NO otherwise. Do not explain.",
].join(" ");

/**
 * ถามโมเดลว่าข้อความเข้าข่ายวิกฤตไหม (YES/NO). คืน false เมื่อผิดพลาด/ตอบไม่ชัด
 * (fail-open ฝั่ง LLM — ด่าน regex เป็นตัวกันหลักอยู่แล้ว).
 */
export async function screenCrisisLlm(text: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CRISIS_LLM_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: CRISIS_LLM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 10, thinkingConfig: { thinkingBudget: 0 } },
        }),
      },
    );
    if (!res.ok) return false;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const answer = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() ?? "";
    return answer.startsWith("YES");
  } catch {
    return false;
  }
}
