// Hour Rectification — llm-question-generator (#hour-rectification-engine).
//
// 🔒 LLM CALL BUDGET GUARD — the single most important property of this file. ฟีม is worried
// about runaway API cost on an unattended overnight run. The counter lives HERE, centrally, so
// every call path that goes through this module is governed — there is no way to reach the LLM
// from this generator without passing the guard first.
//
//   - MAX_LLM_CALLS defaults to 10, overridable via env RECTIFICATION_MAX_LLM_CALLS.
//   - Checked BEFORE every call, not after: if callCount >= max, throws LlmBudgetExceededError
//     immediately — no network request is made for the call that would exceed the budget.
//   - One generator instance = one shared budget for the whole generation run. The caller
//     (generate-network.ts) must create exactly ONE instance per run and reuse it for every call
//     (draft + repairs) — creating a second instance to "reset" the counter defeats the guard and
//     must never be done.
import { generateProseLlm } from "@/lib/bazi/reading-llm";
import type { HourBranch, QuestionNetwork, QuestionNode } from "../domain/types";
import type { HourChartProfile } from "./chart-profile-adapter";
import { HOUR_BRANCH_LABELS_TH } from "../domain/types";
import type { ValidationIssue } from "../domain/validate-tree";
import { MAX_QUESTION_DEPTH } from "../domain/validate-tree";

export class LlmBudgetExceededError extends Error {
  constructor(
    public readonly attemptedCall: number,
    public readonly maxCalls: number,
  ) {
    super(
      `LLM call budget exceeded: attempted call ${attemptedCall} of a max ${maxCalls} — stopping ` +
        `before sending the request. Increase via env RECTIFICATION_MAX_LLM_CALLS if intentional.`,
    );
    this.name = "LlmBudgetExceededError";
  }
}

export const DEFAULT_MAX_LLM_CALLS = 10;

export function resolveMaxLlmCalls(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.RECTIFICATION_MAX_LLM_CALLS;
  if (!raw || !raw.trim()) return DEFAULT_MAX_LLM_CALLS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_LLM_CALLS;
}

type RawLlmCaller = (input: {
  systemInstruction: string;
  userPrompt: string;
}) => Promise<{ text: string; model: string }>;

// Wire format the LLM is instructed to emit — deliberately close to (but not identical to) the
// domain QuestionNetwork shape ("type" not "kind") so a hand-written translation step is a natural
// place to reject malformed output rather than silently coercing it.
type WireNodeRef =
  | { type: "question"; nodeId: string }
  | { type: "result"; hourBranch: string };

type WireOption = { id: string; label: string; next: WireNodeRef };
type WireNode = { id: string; question: string; options: WireOption[] };
type WireTree = { rootNodeId: string; nodes: WireNode[] };

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseWireTree(text: string): WireTree {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch (error) {
    throw new Error(
      `LLM response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("rootNodeId" in parsed) ||
    !("nodes" in parsed) ||
    !Array.isArray((parsed as WireTree).nodes)
  ) {
    throw new Error('LLM response JSON missing required "rootNodeId"/"nodes" shape');
  }
  return parsed as WireTree;
}

function wireNodesToNetworkNodes(wireNodes: WireNode[]): Record<string, QuestionNode> {
  const nodes: Record<string, QuestionNode> = {};
  for (const wireNode of wireNodes) {
    if (!wireNode.id || !wireNode.question || !Array.isArray(wireNode.options)) {
      throw new Error(`LLM produced a malformed node: ${JSON.stringify(wireNode)}`);
    }
    nodes[wireNode.id] = {
      id: wireNode.id,
      question: wireNode.question,
      options: wireNode.options.map((option) => {
        if (!option.id || !option.label || !option.next) {
          throw new Error(`LLM produced a malformed option: ${JSON.stringify(option)}`);
        }
        const next =
          option.next.type === "result"
            ? { kind: "result" as const, hourBranch: option.next.hourBranch as HourBranch }
            : { kind: "question" as const, nodeId: option.next.nodeId };
        return { id: option.id, label: option.label, next };
      }),
    };
  }
  return nodes;
}

function formatProfileForPrompt(profile: HourChartProfile): string {
  const hourPillar = (profile.chart as { fourPillars?: { hour?: Record<string, unknown> } })
    .fourPillars?.hour;
  const strengthScore = (
    profile.chart as { explainable?: { strengthScore?: { value?: number } } }
  ).explainable?.strengthScore?.value;
  return [
    `ยาม${profile.hourBranch} (${HOUR_BRANCH_LABELS_TH[profile.hourBranch]}):`,
    `  เสายาม: ${hourPillar?.stem ?? "?"}${hourPillar?.branch ?? "?"} (${hourPillar?.tenGod ?? "?"})`,
    `  ธาตุก้าน: ${hourPillar?.stemTranslation ?? "?"}, ซ่อน: ${
      Array.isArray(hourPillar?.hiddenStems) ? (hourPillar!.hiddenStems as string[]).join(",") : "-"
    }`,
    `  กำลังดิถีรวม (strengthScore): ${strengthScore ?? "?"}`,
  ].join("\n");
}

// === call 1: condense 12 raw chart profiles into one compact differentiator summary ===
async function summarizeProfiles(
  profiles: HourChartProfile[],
  callLlm: RawLlmCaller,
): Promise<string> {
  const rawProfilesText = profiles.map(formatProfileForPrompt).join("\n\n");
  const systemInstruction =
    "คุณคือนักโหราศาสตร์จีนสาย orthodox ผู้เชี่ยวชาญเรื่อง สอบยาม (Hour Rectification) — " +
    "หาว่าคนที่ไม่รู้เวลาเกิดที่แน่นอน เกิดยามไหนใน 12 ยาม โดยถามคำถามเกี่ยวกับชีวิตจริง";
  const userPrompt = [
    "นี่คือดวงจริงของคนคนเดียวกัน คำนวณ 12 ครั้งด้วยยามที่ต่างกัน (ยามอื่นเหมือนกันหมด ต่างแค่เสายาม):",
    "",
    rawProfilesText,
    "",
    "งาน: สรุปเป็นตารางเปรียบเทียบสั้นๆ ว่าแต่ละยามมีจุดเด่น/ลักษณะนิสัย/พลังงานที่สังเกตได้จากชีวิตจริงต่างกันอย่างไร " +
      "(จากเสายาม ธาตุ เทพเจ้าสิบ กำลังดิถี) เน้นแง่มุมที่แปลงเป็น 'คำถามเกี่ยวกับพฤติกรรม/ประสบการณ์ชีวิต' ที่คนทั่วไปตอบได้เองแม้ไม่รู้ศาสตร์นี้ " +
      "(เช่น นิสัยการทำงาน ความสัมพันธ์กับพ่อแม่ พลังงานตอนเด็ก) ตอบเป็นข้อความธรรมดา กระชับที่สุด ไม่ต้องเป็น JSON",
  ].join("\n");

  const response = await callLlm({ systemInstruction, userPrompt });
  return response.text;
}

// === call 2: generate the full question tree from the condensed summary ===
async function generateFullTree(
  profileSummary: string,
  callLlm: RawLlmCaller,
): Promise<QuestionNetwork> {
  const systemInstruction =
    "คุณคือนักออกแบบแบบสอบถามสำหรับ สอบยาม (Hour Rectification) — สร้างต้นไม้คำถามแบบ multiple-choice " +
    "ที่ทายได้ว่าผู้ตอบเกิดยามไหนใน 12 ยาม โดยถามคำถามชีวิตจริงเท่านั้น (ไม่ถามศัพท์โหราศาสตร์)";
  const userPrompt = [
    "สรุปความต่างของ 12 ยามนี้:",
    "",
    profileSummary,
    "",
    "กติกาบังคับ (ห้ามฝ่าฝืนเด็ดขาด):",
    `- ทุกเส้นทางจากคำถามข้อแรกถึงคำตอบสุดท้าย ต้องมีคำถามไม่เกิน ${MAX_QUESTION_DEPTH} ข้อ เป้าหมายจริงคือ 5-8 ข้อ`,
    "- ทุกคำถามต้องมีอย่างน้อย 2 ตัวเลือก",
    "- ทุก 1 ใน 12 ยามต้องมีอย่างน้อย 1 เส้นทางไปถึงได้จริง (子丑寅卯辰巳午未申酉戌亥 ครบทั้ง 12 ตัวอักษรนี้)",
    "- ห้ามมีเส้นทางวนกลับมาที่คำถามเดิม (ต้องจบที่คำตอบเสมอ ไม่มีวงวน)",
    "- คำถามต้องเป็นเรื่องชีวิตจริงที่คนทั่วไปตอบได้เอง ห้ามถามศัพท์เทคนิค เช่น 'เทพเจ้าสิบของคุณคืออะไร'",
    "",
    "ตอบเป็น JSON ล้วนๆ เท่านั้น (ห้ามมีข้อความอื่นนอก JSON, ห้ามมี markdown code fence) ตรงรูปแบบนี้เป๊ะ:",
    `{"rootNodeId":"q1","nodes":[{"id":"q1","question":"...","options":[{"id":"a","label":"...","next":{"type":"question","nodeId":"q2"}},{"id":"b","label":"...","next":{"type":"result","hourBranch":"子"}}]}]}`,
    'hourBranch ต้องเป็นหนึ่งใน 子丑寅卯辰巳午未申酉戌亥 เท่านั้น (อักษรจีนตัวเดียว)',
  ].join("\n");

  const response = await callLlm({ systemInstruction, userPrompt });
  const wireTree = parseWireTree(response.text);
  return {
    version: "llm-draft",
    generatedAt: new Date().toISOString(),
    rootNodeId: wireTree.rootNodeId,
    nodes: wireNodesToNetworkNodes(wireTree.nodes),
  };
}

// === call 3-10: targeted repair of ONLY the node ids implicated by current validation issues ===
function collectImplicatedNodeIds(issues: ValidationIssue[]): Set<string> {
  const ids = new Set<string>();
  for (const issue of issues) {
    switch (issue.code) {
      case "DANGLING_NODE_REF":
        ids.add(issue.fromNodeId);
        break;
      case "TOO_FEW_OPTIONS":
      case "DUPLICATE_OPTION_ID":
      case "UNREACHABLE_NODE":
        ids.add(issue.nodeId);
        break;
      case "DEPTH_EXCEEDED":
      case "CYCLE_DETECTED":
        issue.path.forEach((nodeId) => ids.add(nodeId));
        break;
      default:
        break;
    }
  }
  return ids;
}

function describeIssuesForPrompt(issues: ValidationIssue[]): string {
  return issues
    .map((issue) => {
      switch (issue.code) {
        case "DANGLING_NODE_REF":
          return `- ข้อ "${issue.fromNodeId}" ตัวเลือก "${issue.optionId}" ชี้ไปข้อ "${issue.toNodeId}" ที่ไม่มีอยู่จริง — ต้องแก้ให้ชี้ไปข้อที่มีจริง หรือเปลี่ยนเป็นคำตอบจบเลย`;
        case "TOO_FEW_OPTIONS":
          return `- ข้อ "${issue.nodeId}" มีแค่ ${issue.optionCount} ตัวเลือก ต้องมีอย่างน้อย 2`;
        case "DUPLICATE_OPTION_ID":
          return `- ข้อ "${issue.nodeId}" มีตัวเลือก id ซ้ำกัน "${issue.optionId}" — ต้องแก้ให้ id ไม่ซ้ำ`;
        case "DEPTH_EXCEEDED":
          return `- เส้นทาง ${issue.path.join(" → ")} ลึกเกิน ${MAX_QUESTION_DEPTH} ข้อ (ตอนนี้ ${issue.depth}) — ต้องย่อเส้นทางนี้ให้สั้นลง`;
        case "CYCLE_DETECTED":
          return `- เส้นทาง ${issue.path.join(" → ")} วนกลับมาที่ข้อเดิม — ต้องแก้ให้จบที่คำตอบ ไม่วนซ้ำ`;
        case "UNREACHABLE_HOUR_BRANCH":
          return `- ยาม${issue.hourBranch} (${HOUR_BRANCH_LABELS_TH[issue.hourBranch]}) ไม่มีเส้นทางไปถึงเลย — ต้องเพิ่ม/แก้ตัวเลือกให้มีทางไปถึงยามนี้ได้จริง`;
        case "UNREACHABLE_NODE":
          return `- ข้อ "${issue.nodeId}" ไม่มีใครชี้มาถึงเลย (ข้อลอย) — ลบทิ้ง หรือเชื่อมให้มีทางไปถึงจริง`;
        default:
          return `- ปัญหาที่ไม่รู้จัก: ${JSON.stringify(issue)}`;
      }
    })
    .join("\n");
}

async function repairIssues(
  network: QuestionNetwork,
  issues: ValidationIssue[],
  profileSummary: string,
  callLlm: RawLlmCaller,
): Promise<QuestionNetwork> {
  const implicatedIds = collectImplicatedNodeIds(issues);
  const implicatedNodes = Array.from(implicatedIds)
    .map((id) => network.nodes[id])
    .filter((node): node is QuestionNode => Boolean(node));

  const systemInstruction =
    "คุณคือนักออกแบบแบบสอบถามสำหรับ สอบยาม (Hour Rectification) กำลังซ่อมต้นไม้คำถามที่มีปัญหาเฉพาะบางจุด " +
    "ห้ามแก้ข้อที่ไม่เกี่ยวข้องกับปัญหาที่ระบุ";
  const userPrompt = [
    "สรุปความต่างของ 12 ยาม (อ้างอิงเดิม):",
    profileSummary,
    "",
    "ต้นไม้ทั้งหมดตอนนี้ (สำหรับดู context เท่านั้น ห้ามแก้ข้อที่ไม่อยู่ในลิสต์ปัญหาด้านล่าง):",
    JSON.stringify(
      { rootNodeId: network.rootNodeId, nodes: Object.values(network.nodes) },
      null,
      2,
    ),
    "",
    "ปัญหาที่ต้องแก้ (เฉพาะจุดนี้เท่านั้น):",
    describeIssuesForPrompt(issues),
    "",
    "ข้อที่เกี่ยวข้องโดยตรง (แก้ตรงนี้ หรือเพิ่มข้อใหม่ถ้าจำเป็นเพื่อแก้ปัญหา 'ไปไม่ถึงยาม'):",
    JSON.stringify(implicatedNodes, null, 2),
    "",
    "ตอบเป็น JSON ล้วนๆ เท่านั้น (ห้าม markdown fence) เป็นลิสต์ของ 'เฉพาะข้อที่แก้ไข/เพิ่มใหม่' เท่านั้น ไม่ต้องส่งข้อที่ไม่เปลี่ยน ตรงรูปแบบ:",
    `{"rootNodeId":"q1","nodes":[{"id":"...","question":"...","options":[...]}]}`,
    "(rootNodeId ใส่ค่าเดิมเสมอ เว้นแต่ root เองมีปัญหาและต้องเปลี่ยน id)",
  ].join("\n");

  const response = await callLlm({ systemInstruction, userPrompt });
  const wireTree = parseWireTree(response.text);
  const patchedNodes = wireNodesToNetworkNodes(wireTree.nodes);

  return {
    ...network,
    rootNodeId: wireTree.rootNodeId || network.rootNodeId,
    nodes: { ...network.nodes, ...patchedNodes },
  };
}

export type LlmQuestionGenerator = {
  summarizeProfiles: (profiles: HourChartProfile[]) => Promise<string>;
  generateFullTree: (profileSummary: string) => Promise<QuestionNetwork>;
  repairIssues: (
    network: QuestionNetwork,
    issues: ValidationIssue[],
    profileSummary: string,
  ) => Promise<QuestionNetwork>;
  getCallCount: () => number;
  getMaxCalls: () => number;
};

export function createLlmQuestionGenerator(
  deps: {
    callLlm?: RawLlmCaller;
    maxCalls?: number;
    env?: Record<string, string | undefined>;
  } = {},
): LlmQuestionGenerator {
  const maxCalls = deps.maxCalls ?? resolveMaxLlmCalls(deps.env);
  const rawCallLlm: RawLlmCaller =
    deps.callLlm ??
    (async (input) => {
      const result = await generateProseLlm({
        systemInstruction: input.systemInstruction,
        userPrompt: input.userPrompt,
        usageLabel: "hour-rectification",
        apiKey: process.env.GEMINI_API_KEY,
      });
      return result;
    });

  let callCount = 0;

  // The ONE place every LLM request in this module funnels through. Checked BEFORE calling.
  const guardedCallLlm: RawLlmCaller = async (input) => {
    if (callCount >= maxCalls) {
      throw new LlmBudgetExceededError(callCount + 1, maxCalls);
    }
    callCount += 1;
    return rawCallLlm(input);
  };

  return {
    summarizeProfiles: (profiles) => summarizeProfiles(profiles, guardedCallLlm),
    generateFullTree: (profileSummary) => generateFullTree(profileSummary, guardedCallLlm),
    repairIssues: (network, issues, profileSummary) =>
      repairIssues(network, issues, profileSummary, guardedCallLlm),
    getCallCount: () => callCount,
    getMaxCalls: () => maxCalls,
  };
}
