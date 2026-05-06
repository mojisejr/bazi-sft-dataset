import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const replaceMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
  }),
}));

vi.mock("@/lib/bazi/semantic-chamber-graph", () => ({
  buildSemanticChamberGraph: () => ({
    nodes: [],
    edges: [],
    schoolClusters: [],
    hiddenSecondaryOverlays: [],
  }),
}));

vi.mock("@/components/bazi/reaction-chamber/ReactionChamberCanvas", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
  ReactionChamberCanvas: ({ legendItems }: { legendItems?: Array<{ label: string; value: string }> }) =>
    createElement("div", { "data-testid": "reaction-chamber-canvas" }, legendItems?.[0]?.value ?? "canvas"),
}));

vi.mock("@/components/bazi/reaction-chamber/ChamberInspector", () => ({
  ChamberInspector: ({ title, summary }: { title?: string; summary?: string }) =>
    createElement("aside", { "data-testid": "chamber-inspector" }, `${title ?? ""} ${summary ?? ""}`.trim()),
}));

import { ReactionChamberShell } from "@/components/bazi/reaction-chamber/ReactionChamberShell";
import { resetBaziWorkspaceSession, seedBaziWorkspaceSession } from "@/lib/bazi/bazi-session-store";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

describe("ReactionChamberShell", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    pushMock.mockReset();
    resetBaziWorkspaceSession();
  });

  test("renders doctrine-first shell when calculated state exists", () => {
    seedBaziWorkspaceSession({
      calculatedState: CalculatedStateSchema.parse({
        fourPillars: {
          year: { stem: "壬", branch: "申" },
          month: { stem: "戊", branch: "申" },
          day: { stem: "己", branch: "巳" },
          hour: { stem: "辛", branch: "未" },
        },
        shenSha: [],
        dayMaster: "己",
        strengthScore: 3.07,
        tenGods: {},
        twelveQi: {},
        baseChartReading: {
          roleBadges: [],
          stemInteractionBadges: [],
          branchInteractionBadges: [],
          markerBadges: [],
          groups: [],
          strengthGate: {
            title: "กำลังดิถี",
            summary: "อ่านกำลังก่อน layer อื่น",
            displayLabel: "สมดุล",
            score: 3.07,
            readingOrderHint: "อ่านกำลังก่อนเสมอ",
          },
          schoolSections: [
            {
              key: "strength-gate",
              title: "กำลังดิถี",
              description: "ชี้ gate แรกของการอ่าน",
              readingOrder: 1,
              badges: [],
            },
            {
              key: "roles",
              title: "จับซิ้ง / บทบาทต่อดิถี",
              description: "อ่านบทบาทก่อนปฏิกิริยา",
              readingOrder: 2,
              badges: [],
            },
          ],
          legendItems: [
            { label: "strength", value: "กำลังดิถีเป็นด่านแรก" },
          ],
          readingOrderSteps: [
            "เริ่มจากดิถีและ ribbon พื้นดวงก่อน",
            "ล็อกกำลังดิถีให้ชัดก่อน ว่าดิถีแข็ง อ่อน หรือสมดุล",
          ],
        },
        elementMetaphors: [],
        elementAnalysis: {
          visibleCounts: { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 },
          hiddenCounts: { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 },
          totalCounts: { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 },
          missingElements: [],
          dominantElements: [],
          elementStrengths: [],
        },
        compatibilityMatrixProfiles: [],
        explainable: {},
      }),
    });

    const html = renderToStaticMarkup(createElement(ReactionChamberShell));

    expect(html).toContain("ลำดับอ่านปฏิกิริยาของดวงนี้");
    expect(html).toContain("กำลังดิถี");
    expect(html).toContain("จับซิ้ง / บทบาทต่อดิถี");
    expect(html).toContain("หลักฐานบนแผนภาพ");
    expect(html).toContain("กำลังดิถีเป็นด่านแรก");
  });
});
