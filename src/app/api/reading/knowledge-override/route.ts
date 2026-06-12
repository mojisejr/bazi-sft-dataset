/**
 * GET /api/reading/knowledge-override — catalog ขององค์ความรู้ที่แก้ได้ + ค่า published + ค่า draft
 * ใช้โดยตัวแก้ในหน้า /reading/knowledge. การเขียน/เผยแพร่/ทิ้งร่าง ใช้ /api/reading/doctrine-draft (surface="knowledge")
 */
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { KNOWLEDGE_CATALOG, keyLabel } from "@/lib/bazi/knowledge/knowledge-catalog";
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

  const tables = KNOWLEDGE_CATALOG.map((entry) => ({
    tableId: entry.tableId,
    label: entry.label,
    keyKind: entry.keyKind,
    entries: Object.keys(entry.defaults).map((key) => ({
      key,
      keyLabel: keyLabel(entry.keyKind, key),
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

  return Response.json({ tables, appends });
}
