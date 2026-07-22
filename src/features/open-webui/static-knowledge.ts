/**
 * ความรู้เสริม fix จาก NewData สำหรับแชท AI (ไม่ผูกดวง) — เช่น ฮวงจุ้ยกระเป๋าตังค์
 *
 * จับ keyword จากข้อความล่าสุดของผู้ใช้ → โหลดก้อนความรู้จาก bazi_newdata
 * (กลุ่ม keyKind "fixed" คีย์ "ทุกคน" — ซินแสแก้เนื้อหาได้ในหน้าแอดมิน /reading/newdata)
 * โหลดไม่ได้/ยังไม่ seed → คืน null เงียบ ๆ (แชททำงานปกติ)
 */
import { getNewdataMap } from "@/lib/bazi/newdata.server";

type StaticKnowledgeRule = {
  group: string;
  /** เข้าเงื่อนไขเมื่อข้อความผู้ใช้ match อย่างน้อย 1 pattern */
  patterns: RegExp[];
};

const RULES: readonly StaticKnowledgeRule[] = [
  {
    group: "wallet_fengshui",
    patterns: [/กระเป๋า/, /wallet/i],
  },
];

export async function resolveStaticKnowledge(userMessage: string): Promise<string | null> {
  const matched = RULES.filter((rule) => rule.patterns.some((rx) => rx.test(userMessage)));
  if (matched.length === 0) return null;
  try {
    const map = await getNewdataMap();
    const texts = matched
      .map((rule) => map[rule.group]?.["ทุกคน"]?.text?.trim())
      .filter((t): t is string => Boolean(t));
    return texts.length ? texts.join("\n\n") : null;
  } catch {
    return null;
  }
}
