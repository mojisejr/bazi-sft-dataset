// mumate-bdash-v2-001 slice 1: narrate records which member a reading was for, so bdash can count people per
// feature. The id goes to the usage log only; the prompt and the answer do not change.
import { afterEach, describe, expect, test, vi } from "vitest";

const generateProseLlm = vi.fn();
vi.mock("@/lib/bazi/reading-llm", () => ({ generateProseLlm }));
vi.mock("@/lib/bazi/llm-guard", () => ({ guardServerLlm: () => null }));

const { POST } = await import("@/app/api/bazi/narrate/route");

function narrate(body: Record<string, unknown>): Promise<Response> {
  return POST(new Request("http://localhost/api/bazi/narrate", { method: "POST", body: JSON.stringify(body) }));
}

afterEach(() => {
  generateProseLlm.mockReset();
});

describe("POST /api/bazi/narrate — member id", () => {
  test("passes the member id to the usage log of a logged feature", async () => {
    generateProseLlm.mockResolvedValue({ text: "คำทำนาย", model: "m" });
    const res = await narrate({ engineText: "ผล", domainLabel: "ทำนายเบอร์มือถือ", feature: "phone_reading", anonId: "member-1" });

    expect(res.status).toBe(200);
    const opts = generateProseLlm.mock.calls[0][0];
    expect(opts.usageFeature).toBe("phone_reading");
    expect(opts.usageAnonId).toBe("member-1");
    expect(opts.userPrompt).not.toContain("member-1");
  });

  test("no member id stays null, as before", async () => {
    generateProseLlm.mockResolvedValue({ text: "คำทำนาย", model: "m" });
    await narrate({ engineText: "ผล", feature: "almanac" });

    expect(generateProseLlm.mock.calls[0][0].usageAnonId).toBeNull();
  });
});

// Owner 2026-10-21: the card and fortune-stick logs now carry the member, so they stop keeping the question text.
describe("card and fortune-stick readings — member id in, question text out", () => {
  const QUESTION = "ควรย้ายงานไหม";

  const usageOf = () => {
    const opts = generateProseLlm.mock.calls[0][0];
    return { feature: opts.usageFeature, label: opts.usageLabel, anonId: opts.usageAnonId };
  };

  test("divine cards", async () => {
    const { drawRandom } = await import("@/lib/bazi/divine-cards/deck");
    const { buildDivineReading } = await import("@/lib/bazi/divine-cards/reading-engine");
    const { polishDivineReading } = await import("@/lib/bazi/divine-cards/reading-llm");
    generateProseLlm.mockResolvedValue({ text: "ok", model: "m" });
    const cards = drawRandom(3, 7) as unknown as Parameters<typeof buildDivineReading>[0];
    await polishDivineReading({ reading: buildDivineReading(cards, QUESTION), question: QUESTION, anonId: "member-1" });
    expect(usageOf()).toEqual({ feature: "divine_cards", label: null, anonId: "member-1" });
  });

  test("oracle cards", async () => {
    const { drawRandom } = await import("@/lib/bazi/oracle-cards/deck");
    const { buildOracleReading } = await import("@/lib/bazi/oracle-cards/reading-engine");
    const { polishOracleReading } = await import("@/lib/bazi/oracle-cards/reading-llm");
    generateProseLlm.mockResolvedValue({ text: "ok", model: "m" });
    const cards = drawRandom(3, 7) as unknown as Parameters<typeof buildOracleReading>[0];
    await polishOracleReading({ reading: buildOracleReading(cards, QUESTION), question: QUESTION, anonId: "member-1" });
    expect(usageOf()).toEqual({ feature: "oracle_cards", label: null, anonId: "member-1" });
  });

  test("fortune sage (เซียมซี)", async () => {
    const { drawRandom } = await import("@/lib/bazi/fortune-sage/deck");
    const { polishSageReading } = await import("@/lib/bazi/fortune-sage/reading-llm");
    generateProseLlm.mockResolvedValue({ text: "ok", model: "m" });
    await polishSageReading({ stick: drawRandom(7), question: QUESTION, anonId: "member-1" });
    expect(usageOf()).toEqual({ feature: "fortune_sage", label: null, anonId: "member-1" });
  });

  test("anonymous use logs no member and still no question", async () => {
    const { drawRandom } = await import("@/lib/bazi/fortune-sage/deck");
    const { polishSageReading } = await import("@/lib/bazi/fortune-sage/reading-llm");
    generateProseLlm.mockResolvedValue({ text: "ok", model: "m" });
    await polishSageReading({ stick: drawRandom(7), question: QUESTION });
    expect(usageOf()).toEqual({ feature: "fortune_sage", label: null, anonId: null });
  });
});
