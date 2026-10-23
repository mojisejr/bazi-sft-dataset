// คลังคำถาม AI เพื่อเทรน (เอ็ม 2026-10-22): เก็บเฉพาะคนยินยอม ai_training · ตัดข้อมูลระบุตัวตน · subject ย้อนหาคนไม่ได้
import { beforeEach, describe, expect, it, vi } from "vitest";

const executed: string[] = [];
let consentRows: { accepted: boolean; version?: string }[] = [];
vi.mock("@/db/client", () => ({
  createDbClient: () => ({
    execute: vi.fn(async (q: { queryChunks?: unknown[] }) => {
      const text = JSON.stringify(q?.queryChunks ?? q);
      executed.push(text);
      if (text.includes("bazi_consent")) return { rows: consentRows };
      return { rows: [] };
    }),
    insert: () => ({ values: async () => undefined }),
  }),
}));

import { AI_TRAINING_VERSION, logAiQuestion as logWithRealRewrite, purgeAiQuestions, scrubPii, subjectFor } from "@/lib/bazi/ai-question-log";
import { plausibleRewriteLength, rewriteAiQuestion, type RewriteGenerateContent } from "@/lib/bazi/ai-question-rewrite";

const USAGE = { model: "test-model", inTokens: 1, outTokens: 1 };
/** โมเดลปลอม: แทนชื่อที่รู้จักด้วย [ชื่อ] — ใช้แทนการเรียก Gemini จริงในเทสต์ */
const fakeRewrite = async (q: string) => ({ text: q.replace(/สมชาย|น้องมิว/g, "[ชื่อ]"), usage: USAGE });
const logAiQuestion = (input: Parameters<typeof logWithRealRewrite>[0]) => logWithRealRewrite(input, { rewrite: fakeRewrite });

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  executed.length = 0;
  consentRows = [];
});

describe("ai-question-log", () => {
  it("scrubPii ตัดเบอร์ อีเมล เลขยาว ลิงก์ — คำถามปกติไม่แตะ", () => {
    expect(scrubPii("เบอร์ 081-234-5678 ดีไหม")).toBe("เบอร์ [เบอร์] ดีไหม");
    expect(scrubPii("ติดต่อ a.b@gmail.com")).toBe("ติดต่อ [อีเมล]");
    expect(scrubPii("บัตร 1 2345 67890 12 3")).toBe("บัตร [ตัวเลข]");
    expect(scrubPii("ดู https://x.co/abc หน่อย")).toBe("ดู [ลิงก์] หน่อย");
    expect(scrubPii("ปี 2569 การเงินจะดีไหม")).toBe("ปี 2569 การเงินจะดีไหม");
    expect(scrubPii("เกิด 12/05/2533 ดวงปีนี้")).toBe("เกิด [วันที่] ดวงปีนี้");
    expect(scrubPii("เกิด 3-1-30 ตอน 10.30 น. ค่ะ")).toBe("เกิด [วันที่] ตอน [เวลา] ค่ะ");
    expect(scrubPii("ก".repeat(2000)).length).toBe(1000);
  });

  it("subject คงที่ต่อคน และไม่ใช่ anon_id", () => {
    expect(subjectFor("U1")).toBe(subjectFor("U1"));
    expect(subjectFor("U1")).not.toBe(subjectFor("U2"));
    expect(subjectFor("U1")).not.toContain("U1");
  });

  it("ไม่ยินยอม/ถอนแล้ว = ไม่เก็บ · ยินยอม = เก็บคำถามที่ตัดข้อมูลแล้ว (ไม่มี anon_id)", async () => {
    logAiQuestion({ anonId: "U1", question: "งานปีนี้" });
    await flush(); await flush();
    expect(executed.some((t) => t.includes("INSERT INTO ai_question_log"))).toBe(false);

    consentRows = [{ accepted: false, version: AI_TRAINING_VERSION }];
    logAiQuestion({ anonId: "U1", question: "งานปีนี้" });
    await flush(); await flush();
    expect(executed.some((t) => t.includes("INSERT INTO ai_question_log"))).toBe(false);

    // ยินยอมรุ่นเดิม (ก่อนเพิ่มการวิเคราะห์เพื่อพัฒนาบริการ) = ไม่เก็บ จนกว่าจะตอบรุ่นนี้
    consentRows = [{ accepted: true, version: "2026-10" }];
    logAiQuestion({ anonId: "U1", question: "งานปีนี้" });
    await flush(); await flush();
    expect(executed.some((t) => t.includes("INSERT INTO ai_question_log"))).toBe(false);

    consentRows = [{ accepted: true, version: AI_TRAINING_VERSION }];
    logAiQuestion({ anonId: "U1", question: "โทร 0812345678 งานปีนี้", persona: "mu", topicId: "career" });
    await flush(); await flush();
    const ins = executed.find((t) => t.includes("INSERT INTO ai_question_log"));
    expect(ins).toBeDefined();
    expect(ins).toContain("โทร [เบอร์] งานปีนี้");
    expect(ins).not.toContain("0812345678");
    expect(ins).not.toContain('"U1"');
  });

  it("ไม่มี anonId หรือคำถามว่าง = ไม่แตะ DB", async () => {
    logAiQuestion({ anonId: null, question: "x y" });
    logAiQuestion({ anonId: "U1", question: " " });
    await flush();
    expect(executed).toHaveLength(0);
  });

  it("purge ลบตาม subject", async () => {
    await purgeAiQuestions("U1");
    expect(executed[0]).toContain("DELETE FROM ai_question_log");
    expect(executed[0]).toContain(subjectFor("U1"));
  });

  it("เกลาก่อนเก็บ: กฎ → โมเดล → กฎอีกรอบ · ชื่อ วันที่ เบอร์ ไม่เหลือ ความหมายเดิม", async () => {
    consentRows = [{ accepted: true, version: AI_TRAINING_VERSION }];
    const seen: string[] = [];
    logWithRealRewrite(
      { anonId: "U1", question: "สมชาย เกิด 12/05/2533 ทำงานที่ศิริราช โทร 0812345678 ปีนี้ปวดหลังจะหายไหม" },
      {
        rewrite: async (q) => {
          seen.push(q);
          // โมเดลแทนชื่อกับสถานที่ แต่ "ลืม" เบอร์ที่หลุดมา → กฎรอบสองต้องจับได้
          return { text: q.replace("สมชาย", "[ชื่อ]").replace("ศิริราช", "[สถานที่]") + " 0899999999", usage: USAGE };
        },
      },
    );
    await flush(); await flush(); await flush();
    expect(seen[0]).not.toContain("12/05/2533");
    expect(seen[0]).not.toContain("0812345678");
    const ins = executed.find((t) => t.includes("INSERT INTO ai_question_log"));
    expect(ins).toBeDefined();
    expect(ins).toContain("[ชื่อ] เกิด [วันที่] ทำงานที่[สถานที่] โทร [เบอร์] ปีนี้ปวดหลังจะหายไหม [เบอร์]");
    for (const leak of ["สมชาย", "12/05/2533", "ศิริราช", "0812345678", "0899999999"]) expect(ins).not.toContain(leak);
  });

  it("เกลาไม่สำเร็จ (null) = ไม่เก็บอะไรเลย", async () => {
    consentRows = [{ accepted: true, version: AI_TRAINING_VERSION }];
    logWithRealRewrite({ anonId: "U1", question: "สมชาย งานปีนี้" }, { rewrite: async () => null });
    await flush(); await flush(); await flush();
    expect(executed.some((t) => t.includes("INSERT INTO ai_question_log"))).toBe(false);
  });

  it("ไม่ยินยอม = ไม่ส่งไปเกลาด้วยซ้ำ", async () => {
    let called = 0;
    logWithRealRewrite({ anonId: "U1", question: "สมชาย งานปีนี้" }, { rewrite: async () => { called++; return null; } });
    await flush(); await flush();
    expect(called).toBe(0);
  });
});

describe("rewriteAiQuestion", () => {
  const env = { GEMINI_API_KEY: "test-key" };
  const answer = (text: string | null): RewriteGenerateContent => async () => ({ text, usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } });

  it("ส่งคำถามพร้อมคำสั่ง แล้วคืนข้อความที่เกลา + โทเคน", async () => {
    let req: Parameters<RewriteGenerateContent>[0] | undefined;
    const r = await rewriteAiQuestion("สมชายงานปีนี้", {
      env,
      generateContent: async (request) => {
        req = request;
        return { text: JSON.stringify({ text: "[ชื่อ]งานปีนี้" }), usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } };
      },
    });
    expect(r?.text).toBe("[ชื่อ]งานปีนี้");
    expect(r?.usage.inTokens).toBe(10);
    expect(req?.contents).toBe("สมชายงานปีนี้");
    expect(req?.config.temperature).toBe(0);
    expect(req?.config.systemInstruction).toContain("[ชื่อ]");
  });

  it("ล้ม ว่าง JSON เสีย หรือยาวผิดปกติ (โมเดลตอบแทนเกลา) = null", async () => {
    expect(await rewriteAiQuestion("งานปีนี้", { env, generateContent: async () => { throw new Error("timeout"); } })).toBeNull();
    expect(await rewriteAiQuestion("งานปีนี้", { env, generateContent: answer(null) })).toBeNull();
    expect(await rewriteAiQuestion("งานปีนี้", { env, generateContent: answer("not json") })).toBeNull();
    expect(await rewriteAiQuestion("งานปีนี้", { env, generateContent: answer(JSON.stringify({ text: "" })) })).toBeNull();
    expect(await rewriteAiQuestion("งานปีนี้", { env, generateContent: answer(JSON.stringify({ text: "ดวงงานปีนี้ของคุณ ".repeat(20) })) })).toBeNull();
  });

  it("ไม่มี GEMINI key = null (ไม่ throw)", async () => {
    expect(await rewriteAiQuestion("งานปีนี้", { env: {} })).toBeNull();
  });

  it("plausibleRewriteLength เผื่อป้ายแทนชื่อ แต่ไม่รับคำตอบยาว", () => {
    expect(plausibleRewriteLength("สมชายงาน", "[ชื่อ]งาน")).toBe(true);
    expect(plausibleRewriteLength("งาน", "")).toBe(false);
    expect(plausibleRewriteLength("งาน", "x".repeat(100))).toBe(false);
  });
});
