import {
  createDeleteRuleHandler,
  createListRulesHandler,
  createSaveRuleHandler,
} from "@/lib/bazi/substitution-rules-repository";

export const runtime = "nodejs";

export const GET = createListRulesHandler({});
export const POST = createSaveRuleHandler({});
export const DELETE = createDeleteRuleHandler({});
