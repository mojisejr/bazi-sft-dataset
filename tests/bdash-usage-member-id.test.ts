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
