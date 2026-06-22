/**
 * GET /api/reading/knowledge-override — catalog ขององค์ความรู้ที่แก้ได้ + ค่า published + ค่า draft
 * ใช้โดยตัวแก้ในหน้า /reading/knowledge. การเขียน/เผยแพร่/ทิ้งร่าง ใช้ /api/reading/doctrine-draft (surface="knowledge")
 */
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { BAZI_TOPIC_REGISTRY } from "@/lib/bazi/knowledge/topic-registry";
import {
  CONDITION_TABLE_CATEGORY,
  miscEntryCategory,
} from "@/lib/bazi/knowledge/condition-categories";
import { KNOWLEDGE_CATALOG, keyLabel } from "@/lib/bazi/knowledge/knowledge-catalog";
import { STANDALONE_EDITABLE_TABLES } from "@/lib/bazi/knowledge/standalone-tables";
import { createDbKnowledgeOverrideRepository } from "@/lib/bazi/knowledge-override-repository";
import { EMPTY_OVERLAY, type KnowledgeOverlay } from "@/lib/bazi/knowledge/knowledge-overlay";
import { createDbDoctrineDraftRepository } from "@/lib/bazi/doctrine-draft-repository";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (!expected) return true;
  return req.headers.get("x-admin-token")?.trim() === expected;
}

const PREDICT_TOPICS = TOPIC_PATH.filter((topic) => topic.kind === "predict");

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: { message: "unauthorized" } }, { status: 401 });
  }

  let published: KnowledgeOverlay = EMPTY_OVERLAY;
  try {
    published = await createDbKnowledgeOverrideRepository().load();
  } catch {
    /* DB ยังไม่พร้อม — โชว์ default ได้ */
  }

  let draft: KnowledgeOverlay = EMPTY_OVERLAY;
  try {
    draft = (await createDbDoctrineDraftRepository().loadParsed()).knowledge;
  } catch {
    /* ไม่มีร่าง */
  }

  const tables = KNOWLEDGE_CATALOG.flatMap((entry) => {
    const mkEntry = (key: string) => ({
      key,
      keyLabel: entry.entryLabels?.[key] ?? keyLabel(entry.keyKind, key),
      default: entry.defaults[key],
      published: published.tables[entry.tableId]?.[key] ?? null,
      draft: draft.tables[entry.tableId]?.[key] ?? null,
    });
    const keys = Object.keys(entry.defaults);
    // MISC คร่อมหลายบท → แตกเป็น virtual table ต่อหมวด (tableId/key เดิม → save/deep-link ไม่กระทบ)
    if (entry.tableId === "MISC_TEMPLATE_TH") {
      const byCategory = new Map<string, string[]>();
      for (const key of keys) {
        const category = miscEntryCategory(key);
        const bucket = byCategory.get(category) ?? [];
        bucket.push(key);
        byCategory.set(category, bucket);
      }
      return [...byCategory.entries()].map(([category, ks]) => ({
        tableId: entry.tableId,
        label: `โครงประโยค: ${category}`,
        keyKind: entry.keyKind,
        category,
        entries: ks.map(mkEntry),
      }));
    }
    return [
      {
        tableId: entry.tableId,
        label: entry.label,
        keyKind: entry.keyKind,
        category: CONDITION_TABLE_CATEGORY[entry.tableId] ?? null,
        entries: keys.map(mkEntry),
      },
    ];
  });

  // ตารางอิสระ (core data ที่แก้ได้ แต่ไม่ผูก engine) — surface แยก field ไม่ปนกับ tables ของ engine
  const standaloneTables = STANDALONE_EDITABLE_TABLES.map((entry) => ({
    tableId: entry.tableId,
    label: entry.label,
    keyKind: entry.keyKind,
    category: null as string | null,
    entries: Object.keys(entry.defaults).map((key) => ({
      key,
      keyLabel: entry.entryLabels?.[key] ?? keyLabel(entry.keyKind, key),
      default: entry.defaults[key],
      published: published.tables[entry.tableId]?.[key] ?? null,
      draft: draft.tables[entry.tableId]?.[key] ?? null,
    })),
  }));

  const appends = Object.fromEntries(
    PREDICT_TOPICS.map((topic) => [
      topic.id,
      {
        published: published.appends[topic.id] ?? [],
        draft: draft.appends[topic.id] ?? [],
      },
    ]),
  );

  // องค์ความรู้แกนรายบท (registry) — หลักการซินแส + reasoningFocus ของแหล่งอ้างอิง
  // คาย default + published + draft รายช่อง (ordinal เริ่ม 1) ให้ตัวแก้ทับได้
  const registry = BAZI_TOPIC_REGISTRY.map((topic) => {
    const pub = published.registry[topic.id] ?? {};
    const drf = draft.registry[topic.id] ?? {};
    const sourceDefaults = topic.sourceRefs.map((ref) => ref.reasoningFocus);
    const lineEntries = (
      kind: "logic" | "sourcefocus",
      defaults: readonly string[],
      pubMap: Record<number, string> | undefined,
      drfMap: Record<number, string> | undefined,
    ) =>
      defaults.map((def, index) => {
        const ordinal = index + 1;
        return {
          kind,
          ordinal,
          default: def,
          published: pubMap?.[ordinal] ?? null,
          draft: drfMap?.[ordinal] ?? null,
        };
      });
    return {
      topicId: topic.id,
      thaiLabel: topic.thaiLabel,
      annotationDimension: topic.annotationDimension,
      logicRules: lineEntries("logic", topic.sinsaeLogicRules, pub.logicRules, drf.logicRules),
      sourceFocus: lineEntries("sourcefocus", sourceDefaults, pub.sourceFocus, drf.sourceFocus),
    };
  });

  return Response.json({ tables, standaloneTables, appends, registry });
}
