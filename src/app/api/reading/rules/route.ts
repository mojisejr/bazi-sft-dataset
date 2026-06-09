import { randomUUID } from "node:crypto";

import { z } from "zod";

import { type SubstitutionRule } from "@/lib/bazi/substitution-rules";
import { readRules, writeRules } from "@/lib/bazi/substitution-rules-store";

export const runtime = "nodejs";

const RuleInputSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    scope: z.enum(["topic", "global"]).default("topic"),
    topicId: z.string().trim().min(1).optional(),
    match: z.string().trim().min(1),
    replacement: z.string().default(""),
    note: z.string().trim().optional(),
    source: z
      .object({
        kind: z.enum(["manual", "diff"]).default("manual"),
        chartSignature: z.string().trim().optional(),
      })
      .default({ kind: "manual" }),
  })
  .refine((value) => value.scope === "global" || Boolean(value.topicId), {
    message: "scope = topic ต้องระบุ topicId",
  });

function badRequest(message: string) {
  return Response.json({ error: { message } }, { status: 400 });
}

export function GET() {
  return Response.json(readRules());
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = RuleInputSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid rule.");
  }
  const input = parsed.data;
  const set = readRules();
  const existingIndex = input.id ? set.rules.findIndex((rule) => rule.id === input.id) : -1;

  const rule: SubstitutionRule = {
    id: input.id ?? randomUUID(),
    scope: input.scope,
    topicId: input.scope === "topic" ? input.topicId : undefined,
    match: input.match,
    replacement: input.replacement,
    note: input.note,
    source: input.source,
    createdAt:
      existingIndex >= 0 ? set.rules[existingIndex].createdAt : new Date().toISOString(),
    hitCount: existingIndex >= 0 ? set.rules[existingIndex].hitCount : 0,
  };

  if (existingIndex >= 0) {
    set.rules[existingIndex] = rule;
  } else {
    set.rules.push(rule);
  }
  writeRules(set);
  return Response.json({ rule, rules: set.rules });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return badRequest("ต้องระบุ id ของกฎที่จะลบ");
  }
  const set = readRules();
  const next = set.rules.filter((rule) => rule.id !== id);
  writeRules({ rules: next });
  return Response.json({ rules: next });
}
