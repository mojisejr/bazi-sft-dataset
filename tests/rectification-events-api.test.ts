// Hour Rectification v2 — POST /api/bazi/rectify-hour/events (#hour-rectification-engine, event-based
// lane, TIER 1 end-to-end). Same DB-free-by-construction proof as the v1 route test: mocking the DB
// client to THROW shows structurally that this route can never touch the DB.
//
// NOTE (intended, end-to-end): the route computes the user's 12 REAL hour charts (the adapter is NOT
// mocked — buildHourChartFacts calls the real calc engine via a no-op knowledge repository), so
// birthDate must be a real date the engine can compute. The engine outcome for a given birth data +
// events is deterministic but its WINNING branch is a property of the chart, not hardcoded — so the
// happy-path test asserts a well-formed 200 whose status is one of the two valid engine outcomes
// ("result" | "inconclusive"), with the matching shape, rather than a fixed time.
import { describe, expect, test, vi } from "vitest";

// Prove DB-free by construction: any attempt to build a DB client throws loudly.
vi.mock("@/db/client", () => ({
  createDbClient: vi.fn(() => {
    throw new Error("rectify-hour events route must not construct a DB client");
  }),
  createDbSqlClient: vi.fn(() => {
    throw new Error("rectify-hour events route must not construct a DB sql client");
  }),
}));

const VALID_BIRTH = {
  birthDate: "1989-01-03",
  gender: "male",
  province: "กรุงเทพมหานคร",
} as const;

function createRequest(body: unknown) {
  return new Request("http://localhost/api/bazi/rectify-hour/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bazi/rectify-hour/events — input validation (400s), never touches DB", () => {
  test("fewer than MIN_EVENTS (1 event) → 400 via zod .min(MIN_EVENTS)", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/events/route");
    const response = await POST(
      createRequest({ ...VALID_BIRTH, events: [{ type: "marriage", year: 2015 }] }),
    );
    // The schema enforces events.length >= 2 BEFORE the engine runs, so <2 is a 400 ZodError, not
    // the runtime's status:"need_events" (which is only reachable by calling the use-case directly).
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  test('birthDate that passes the shape regex but is not a real date ("2026-99-99") → 400', async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/events/route");
    const response = await POST(
      createRequest({
        ...VALID_BIRTH,
        birthDate: "2026-99-99",
        events: [
          { type: "marriage", year: 2015 },
          { type: "career_change", year: 2013 },
        ],
      }),
    );
    expect(response.status).toBe(400);
  });

  test("an out-of-range event year (พ.ศ. sent raw, e.g. 2560) → 400 via year max(2100)", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/events/route");
    const response = await POST(
      createRequest({
        ...VALID_BIRTH,
        events: [
          { type: "marriage", year: 2560 }, // Buddhist-era year leaked past the adapter
          { type: "career_change", year: 2558 },
        ],
      }),
    );
    expect(response.status).toBe(400);
  });

  test("an unknown event type → 400 via z.enum(EVENT_TYPES)", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/events/route");
    const response = await POST(
      createRequest({
        ...VALID_BIRTH,
        events: [
          { type: "not_a_real_event", year: 2015 },
          { type: "marriage", year: 2013 },
        ],
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/bazi/rectify-hour/events — the deterministic engine run (real chart, no DB)", () => {
  test("valid 2-event request → 200 with a valid engine outcome and the matching shape", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/events/route");
    const response = await POST(
      createRequest({
        ...VALID_BIRTH,
        events: [
          { type: "marriage", year: 2015 },
          { type: "career_change", year: 2013 },
        ],
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;

    // need_events is unreachable here (zod already guaranteed >= 2 events), so the only valid 200
    // outcomes are "result" and "inconclusive".
    expect(["result", "inconclusive"]).toContain(body.status);

    if (body.status === "result") {
      const est = body.timeEstimate as Record<string, unknown>;
      expect(typeof est.point).toBe("string");
      expect(est.point).toMatch(/^\d{2}:\d{2}$/);
      expect(typeof est.rangeStart).toBe("string");
      expect(typeof est.rangeEnd).toBe("string");
      expect(typeof est.spansAdjacent).toBe("boolean");
      expect(body.confidence).toBe("beta");
      expect(Array.isArray(body.rankedYams)).toBe(true);
      expect((body.rankedYams as unknown[]).length).toBeGreaterThan(0);
      expect((body.rankedYams as unknown[]).length).toBeLessThanOrEqual(3);
      const trace = body.trace as Record<string, unknown>;
      expect(Array.isArray(trace.steps)).toBe(true);
    } else {
      // inconclusive: no time estimate, but a ranked list + a human reason.
      expect(Array.isArray(body.rankedYams)).toBe(true);
      expect(typeof body.reason).toBe("string");
      expect((body.reason as string).length).toBeGreaterThan(0);
    }
  });

  test("deterministic: the same request twice yields byte-identical bodies", async () => {
    const { POST } = await import("@/app/api/bazi/rectify-hour/events/route");
    const payload = {
      ...VALID_BIRTH,
      events: [
        { type: "marriage", year: 2015 },
        { type: "career_change", year: 2013 },
      ],
    };
    const a = await (await POST(createRequest(payload))).text();
    const b = await (await POST(createRequest(payload))).text();
    expect(a).toBe(b);
  });
});
