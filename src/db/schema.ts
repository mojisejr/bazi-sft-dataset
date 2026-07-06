import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  type StoredAnnotationDataValue,
  type CalculatedStateValue,
  REQUIRED_ANNOTATION_DIMENSION_COUNT,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import { type DatasetRecordMetadataValue } from "@/lib/bazi/dataset-metadata";
import {
  type ReadingSessionDataValue,
  type ReadingSessionMetadataValue,
} from "@/lib/bazi/reading-session-types";

export type CanonicalMetadataValue = Record<string, unknown>;

export type CanonicalRawCellsValue = string[];

export type CanonicalHeadingValue = string[];

export const intentDomainEnum = pgEnum("intent_domain", [
  "general",
  "work",
  "study",
  "wealth",
  "love",
  "health",
  "family",
  "other",
  "timing",
]);

export const datasetStatusEnum = pgEnum("dataset_status", [
  "draft",
  "reviewed",
  "rejected",
  "exported",
]);

export const knowledgeDomainEnum = pgEnum("bazi_knowledge_domain", [
  "general",
  "work",
  "study",
  "wealth",
  "love",
  "health",
  "family",
  "other",
  "timing",
]);

export const knowledgeSourceFormatEnum = pgEnum("bazi_knowledge_source_format", [
  "csv",
  "markdown",
  "docx",
  "xlsx",
]);

export const sourceRootEnum = pgEnum("bazi_source_root", [
  "distilled",
  "raw",
]);

export const matrixDomainEnum = pgEnum("bazi_matrix_domain", ["love", "work"]);

export const readingSessionStatusEnum = pgEnum("reading_session_status", [
  "in_progress",
  "done",
]);

export const reviewedDatasetContentCheckName =
  "bazi_dataset_records_reviewed_content_check";

export const baziDatasetRecords = pgTable(
  "bazi_dataset_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rawInput: jsonb("raw_input").$type<RawInputValue>().notNull(),
    calculatedState: jsonb("calculated_state")
      .$type<CalculatedStateValue>()
      .notNull(),
    intentDomain: intentDomainEnum("intent_domain").notNull().default("general"),
    annotationData: jsonb("annotation_data").$type<StoredAnnotationDataValue>(),
    status: datasetStatusEnum("status").notNull().default("draft"),
    annotatorId: text("annotator_id"),
    metadata: jsonb("metadata")
      .$type<DatasetRecordMetadataValue>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      reviewedDatasetContentCheckName,
      sql`(
        (
          ${table.status} <> 'reviewed'
          AND ${table.status} <> 'rejected'
        )
        OR (
          ${table.status} = 'reviewed'
          AND
          ${table.annotationData} IS NOT NULL
          AND jsonb_typeof(${table.annotationData}) = 'object'
          AND nullif(btrim(${table.annotationData} ->> 'sinsaeProofNote'), '') IS NOT NULL
          AND jsonb_typeof(${table.annotationData} -> 'dimensions') = 'array'
          AND jsonb_array_length(${table.annotationData} -> 'dimensions') = ${REQUIRED_ANNOTATION_DIMENSION_COUNT}
          AND NOT jsonb_path_exists(
            ${table.annotationData},
            '$.dimensions[*] ? (@.dimension_name == null || @.dimension_name == "" || @.thought_process == null || @.thought_process == "" || @.final_prediction == null || @.final_prediction == "")'
          )
        )
        OR (
          ${table.status} = 'rejected'
          AND ${table.annotationData} IS NOT NULL
          AND jsonb_typeof(${table.annotationData}) = 'object'
          AND nullif(btrim(${table.annotationData} ->> 'sinsaeProofNote'), '') IS NOT NULL
        )
      )`,
    ),
  ],
);

export const baziCanonicalSources = pgTable("bazi_canonical_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  relativePath: text("relative_path").notNull().unique(),
  sourceRoot: sourceRootEnum("source_root").notNull(),
  sourceFormat: knowledgeSourceFormatEnum("source_format").notNull(),
  title: text("title").notNull(),
  domain: knowledgeDomainEnum("domain").notNull().default("general"),
  normalizedTable: text("normalized_table"),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const baziReferenceDocuments = pgTable("bazi_reference_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull().unique(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  domain: knowledgeDomainEnum("domain").notNull().default("general"),
  content: text("content").notNull(),
  headings: jsonb("headings").$type<CanonicalHeadingValue>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const baziCanonicalRawRows = pgTable("bazi_canonical_raw_rows", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  sourceGroup: text("source_group").notNull(),
  rowOrder: integer("row_order").notNull(),
  primaryValue: text("primary_value"),
  secondaryValue: text("secondary_value"),
  cells: jsonb("cells").$type<CanonicalRawCellsValue>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziTimeSolarTerms = pgTable("bazi_time_solar_terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path"),
  label: text("label").notNull(),
  solarTermName: text("solar_term_name"),
  boundaryAt: text("boundary_at"),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziFaqTaxonomies = pgTable("bazi_faq_taxonomies", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  rowGroup: integer("row_group").notNull(),
  questionOrder: integer("question_order").notNull(),
  rawTypeLabel: text("raw_type_label").notNull(),
  primaryIntent: knowledgeDomainEnum("primary_intent").notNull(),
  intentDomains: jsonb("intent_domains").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  questionText: text("question_text").notNull(),
  normalizedQuestion: text("normalized_question").notNull(),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziElementInteractions = pgTable("bazi_element_interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  sourceTable: text("source_table").notNull(),
  dayMaster: text("day_master"),
  leftSymbol: text("left_symbol").notNull(),
  rightSymbol: text("right_symbol"),
  relationType: text("relation_type").notNull(),
  qiLabel: text("qi_label"),
  note: text("note"),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * @deprecated Runtime twelve-qi stage calculation now derives from orthodox
 * `lunar-javascript` math. Keep this table only as a temporary rollback/audit
 * surface until the production drop migration is approved.
 */
export const baziTwelveQiStages = pgTable("bazi_twelve_qi_stages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  stageOrder: integer("stage_order").notNull(),
  stageNameChinese: text("stage_name_chinese").notNull(),
  stageNameThai: text("stage_name_thai").notNull(),
  dayMaster: text("day_master").notNull(),
  branch: text("branch").notNull(),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziDayMasterProfiles = pgTable("bazi_day_master_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  recordNumber: integer("record_number"),
  dayMasterCode: text("day_master_code").notNull(),
  branchCode: text("branch_code").notNull(),
  dayMasterChinese: text("day_master_chinese"),
  branchChinese: text("branch_chinese"),
  baselineOriginal: text("baseline_original"),
  dayMasterTrait: text("day_master_trait"),
  mergedBaseline: text("merged_baseline"),
  interpretedProfile: text("interpreted_profile"),
  conciseProfile: text("concise_profile"),
  combinedNarrative: text("combined_narrative"),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziDayMasterStrengthStates = pgTable("bazi_day_master_strength_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  sourceVariant: text("source_variant").notNull(),
  dayMasterCode: text("day_master_code"),
  dayMasterChinese: text("day_master_chinese"),
  strengthState: text("strength_state"),
  scoreText: text("score_text"),
  qiLabel: text("qi_label"),
  narrativeSummary: text("narrative_summary"),
  rowOrder: integer("row_order").notNull(),
  rawCells: jsonb("raw_cells").$type<CanonicalRawCellsValue>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziSixtyJiaziNarratives = pgTable("bazi_sixty_jiazi_narratives", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  rowGroup: integer("row_group").notNull(),
  dayMasterCode: text("day_master_code").notNull(),
  dayMasterChinese: text("day_master_chinese").notNull(),
  branchCode: text("branch_code").notNull(),
  branchChinese: text("branch_chinese").notNull(),
  elementTone: text("element_tone"),
  twelveQiLabel: text("twelve_qi_label"),
  dayMasterNarrative: text("day_master_narrative"),
  branchNarrative: text("branch_narrative"),
  combinedNarrative: text("combined_narrative"),
  rawCells: jsonb("raw_cells").$type<CanonicalRawCellsValue>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziDomainMatrices = pgTable("bazi_domain_matrices", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePath: text("source_path").notNull(),
  domain: matrixDomainEnum("domain").notNull(),
  sourceVariant: text("source_variant").notNull(),
  pairKey: text("pair_key"),
  rowOrder: integer("row_order").notNull(),
  code: text("code"),
  label: text("label"),
  scoreText: text("score_text"),
  narrative: text("narrative"),
  rawCells: jsonb("raw_cells").$type<CanonicalRawCellsValue>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<CanonicalMetadataValue>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BaziChatHistoryMessage = {
  role: "user" | "model";
  content: string;
};

export const userLineMappings = pgTable("user_line_mappings", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  lineUserId: text("line_user_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const baziChatHistories = pgTable("bazi_chat_histories", {
  id: uuid("id").defaultRandom().primaryKey(),
  lineUserId: text("line_user_id").notNull().unique(),
  messages: jsonb("messages")
    .$type<BaziChatHistoryMessage[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

/**
 * Override ของ "วิธีการอ่านรายบท" ที่ซินแสปรับออนไลน์ (ทับค่า default ใน topic-path.ts)
 * เก็บเฉพาะฟิลด์เชิงข้อความ/ลำดับ (lens/title/stepNumbers/relationKeys) — ไม่แตะ logic/algorithm
 * 1 แถวต่อ 1 topicId; engine จะ merge ทับค่า default แล้ว fallback เป็น default เมื่อไม่มี/ผิดรูป
 */
export type ReadingDoctrineOverridePayload = {
  lens?: string;
  title?: string;
  stepNumbers?: number[];
  relationKeys?: string[];
};

export const baziReadingDoctrineOverrides = pgTable("bazi_reading_doctrine_overrides", {
  topicId: text("topic_id").primaryKey(),
  override: jsonb("override")
    .$type<ReadingDoctrineOverridePayload>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertBaziReadingDoctrineOverride = typeof baziReadingDoctrineOverrides.$inferInsert;
export type SelectBaziReadingDoctrineOverride = typeof baziReadingDoctrineOverrides.$inferSelect;

/**
 * Doctrine config v2 — override ข้อความของ "นิยาม 7 ขั้น / ป้าย-ความหมาย role / ดาวพิเศษ"
 * keyed (scope, config_key): scope ∈ step|role|star ; value = jsonb payload เฉพาะ scope
 */
export type DoctrineConfigValue = Record<string, unknown>;

export const baziDoctrineConfig = pgTable(
  "bazi_doctrine_config",
  {
    scope: text("scope").notNull(),
    configKey: text("config_key").notNull(),
    value: jsonb("value").$type<DoctrineConfigValue>().notNull().default(sql`'{}'::jsonb`),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.scope, table.configKey] }),
  }),
);

export type InsertBaziDoctrineConfig = typeof baziDoctrineConfig.$inferInsert;
export type SelectBaziDoctrineConfig = typeof baziDoctrineConfig.$inferSelect;

/**
 * Audit log (append-only) ของการแก้ doctrine ออนไลน์ — ใช้ดูประวัติ + rollback
 * surface: "topic" (TOPIC_PATH override) | "config" (นิยามขั้น/role/star)
 * entityKey: topicId  หรือ  "scope:key" (เช่น "step:balance-core")
 * action: "upsert" | "delete" ; value = ค่าที่ apply (null เมื่อ delete)
 */
export type DoctrineAuditValue = Record<string, unknown> | null;

export const baziDoctrineAudit = pgTable("bazi_doctrine_audit", {
  id: uuid("id").defaultRandom().primaryKey(),
  surface: text("surface").notNull(),
  entityKey: text("entity_key").notNull(),
  action: text("action").notNull(),
  value: jsonb("value").$type<DoctrineAuditValue>(),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertBaziDoctrineAudit = typeof baziDoctrineAudit.$inferInsert;
export type SelectBaziDoctrineAudit = typeof baziDoctrineAudit.$inferSelect;

/**
 * Draft overlay — ฉบับร่างที่ซินแสแก้ค้างไว้ (ยังไม่เผยแพร่)
 * engine live จะไม่อ่านตารางนี้; เห็นเฉพาะ preview จนกว่าจะ "เผยแพร่" (publish) ไปยังตาราง live
 * surface: "topic" | "config" ; entityKey: topicId หรือ "scope:key"
 */
export type DoctrineDraftValue = Record<string, unknown>;

export const baziDoctrineDraft = pgTable(
  "bazi_doctrine_draft",
  {
    surface: text("surface").notNull(),
    entityKey: text("entity_key").notNull(),
    value: jsonb("value").$type<DoctrineDraftValue>().notNull().default(sql`'{}'::jsonb`),
    actor: text("actor"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.surface, table.entityKey] }),
  }),
);

export type InsertBaziDoctrineDraft = typeof baziDoctrineDraft.$inferInsert;
export type SelectBaziDoctrineDraft = typeof baziDoctrineDraft.$inferSelect;

/**
 * ประวัติการดูดวง (reading session) — เก็บงานของหน้า /reading ลงฐานข้อมูล
 * (แยกต่างหากจาก bazi_dataset_records ของ SFT) เพื่อให้กลับมาแก้ต่อ / ปริ้นซ้ำ / ฝากคนอื่นแก้
 * คอลัมน์ระดับบนสุดดึงมาจาก rawInput/calculatedState/sessionData เพื่อ list/sort ได้โดยไม่ parse blob
 * `session_data` = blob คืนสภาพ workspace เต็ม (topicStates/corrections/readings/relationshipLines/provider)
 * `calculated_state` = snapshot ดวง (ปริ้นซ้ำให้คงที่ + restore ทันที ไม่ต้องคำนวณใหม่)
 */
export const baziReadingSessions = pgTable("bazi_reading_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label"),
  birthDate: text("birth_date").notNull(),
  birthTime: text("birth_time").notNull(),
  gender: text("gender").notNull(),
  dayMaster: text("day_master"),
  provider: text("provider").notNull().default("gemini"),
  status: readingSessionStatusEnum("status").notNull().default("in_progress"),
  rawInput: jsonb("raw_input").$type<RawInputValue>().notNull(),
  calculatedState: jsonb("calculated_state").$type<CalculatedStateValue>(),
  sessionData: jsonb("session_data")
    .$type<ReadingSessionDataValue>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  metadata: jsonb("metadata")
    .$type<ReadingSessionMetadataValue>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  ownerId: text("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertBaziReadingSession = typeof baziReadingSessions.$inferInsert;
export type SelectBaziReadingSession = typeof baziReadingSessions.$inferSelect;

/**
 * เวอร์ชัน PDF ที่บันทึก (snapshot) — แช่แข็งสภาพงานของดวงหนึ่ง ณ ตอนกด "บันทึกเวอร์ชัน PDF"
 * insert-only (ไม่เคย update) → เก็บได้หลายเวอร์ชันต่อ 1 ดวง ย้อนกลับมาแก้/ปริ้นเวอร์ชันเดิมได้
 * โครงคอลัมน์มิเรอร์ bazi_reading_sessions (ยกเว้น session_id/version_note/ไม่มี updated_at)
 * `session_id` = ดวงต้นทาง (nullable — ดวงอาจถูกลบ ก็ยังเก็บเวอร์ชันไว้ได้, ไม่ผูก hard FK)
 */
export const baziReadingPdfVersions = pgTable("bazi_reading_pdf_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id"),
  label: text("label"),
  versionNote: text("version_note"),
  birthDate: text("birth_date").notNull(),
  birthTime: text("birth_time").notNull(),
  gender: text("gender").notNull(),
  dayMaster: text("day_master"),
  provider: text("provider").notNull().default("gemini"),
  status: readingSessionStatusEnum("status").notNull().default("in_progress"),
  rawInput: jsonb("raw_input").$type<RawInputValue>().notNull(),
  calculatedState: jsonb("calculated_state").$type<CalculatedStateValue>(),
  sessionData: jsonb("session_data")
    .$type<ReadingSessionDataValue>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  ownerId: text("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertBaziReadingPdfVersion = typeof baziReadingPdfVersions.$inferInsert;
export type SelectBaziReadingPdfVersion = typeof baziReadingPdfVersions.$inferSelect;

/**
 * ประวัติการบันทึก (reading session revision) — สแน็ปช็อตสภาพงานทุกครั้งที่กด "บันทึกการดูดวง"
 * insert-only เหมือน pdf_versions แต่ถูกสร้าง "อัตโนมัติทุกครั้งที่บันทึก session" (ไม่ใช่ตอนกดบันทึกเวอร์ชัน PDF)
 * → ย้อนกลับไปเปิดดู/กู้คืนสภาพงานแต่ละครั้งที่บันทึกได้ (กันงานถูกเขียนทับหายแบบ live session)
 * เก็บล่าสุด ~30 อัน/ดวง (prune ใน repository.saveSession) · ผูก FK ON DELETE CASCADE กับดวงต้นทาง
 */
export const baziReadingSessionRevisions = pgTable("bazi_reading_session_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => baziReadingSessions.id, { onDelete: "cascade" }),
  label: text("label"),
  birthDate: text("birth_date").notNull(),
  birthTime: text("birth_time").notNull(),
  gender: text("gender").notNull(),
  dayMaster: text("day_master"),
  provider: text("provider").notNull().default("gemini"),
  status: readingSessionStatusEnum("status").notNull().default("in_progress"),
  rawInput: jsonb("raw_input").$type<RawInputValue>().notNull(),
  calculatedState: jsonb("calculated_state").$type<CalculatedStateValue>(),
  sessionData: jsonb("session_data")
    .$type<ReadingSessionDataValue>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  ownerId: text("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertBaziReadingSessionRevision = typeof baziReadingSessionRevisions.$inferInsert;
export type SelectBaziReadingSessionRevision = typeof baziReadingSessionRevisions.$inferSelect;

/**
 * กฎแทนคำของซินแส (phrase substitution rules) — เก็บลง DB ให้ persist จริง (ก่อนหน้านี้เคยเป็น
 * ไฟล์ JSON ใน source tree ซึ่งบน Vercel เขียนไม่ได้ → กฎหายทุก refresh/redeploy)
 * `source` = ที่มาของกฎ (manual/diff) + chartSignature; replacement = "" หมายถึง "ลบวลีทิ้ง"
 */
export const baziSubstitutionRules = pgTable("bazi_substitution_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  scope: text("scope").notNull().default("topic"),
  topicId: text("topic_id"),
  match: text("match").notNull(),
  replacement: text("replacement").notNull().default(""),
  note: text("note"),
  source: jsonb("source")
    .$type<{ kind: "manual" | "diff"; chartSignature?: string }>()
    .notNull()
    .default(sql`'{"kind":"manual"}'::jsonb`),
  hitCount: integer("hit_count").notNull().default(0),
  ownerId: text("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertBaziSubstitutionRule = typeof baziSubstitutionRules.$inferInsert;
export type SelectBaziSubstitutionRule = typeof baziSubstitutionRules.$inferSelect;

/**
 * เฟส 2 — ที่เก็บ "override องค์ความรู้" ของ engine ที่ซินแสแก้ออนไลน์ (live; draft/audit ใช้ตาราง doctrine ร่วม)
 *  - kind = "table"  → group_key = tableId, item_key = entryKey (แทนค่า TABLE[key])
 *  - kind = "append" → group_key = topicId, item_key = ลำดับ ("1","2"…) (ย่อหน้าความรู้ที่ต่อท้ายบท)
 * value = { text }
 */
export const baziKnowledgeOverride = pgTable(
  "bazi_knowledge_override",
  {
    kind: text("kind").notNull(),
    groupKey: text("group_key").notNull(),
    itemKey: text("item_key").notNull(),
    value: jsonb("value").$type<{ text: string }>().notNull(),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.kind, table.groupKey, table.itemKey] })],
);

export type InsertBaziKnowledgeOverride = typeof baziKnowledgeOverride.$inferInsert;
export type SelectBaziKnowledgeOverride = typeof baziKnowledgeOverride.$inferSelect;

/**
 * "ข้อมูลหลักแบบใหม่" (NewData) — คำอ่านชุดใหม่ที่ซินแสส่งเข้ามา (knownlage/NewData)
 * เก็บเป็น dictionary ของ "ก้อนความรู้พื้นฐาน (primitive)" ที่ engine คำนวณได้แล้วหยิบไป lookup
 *   group_key = ชนิดก้อนความรู้ (1 ไฟล์ = 1 group) เช่น "shengxiang" | "clash" | "phua" | "edu_level"
 *   item_key  = คีย์ภายในก้อน ตรงกับค่าที่ engine คำนวณได้ เช่น "กวงตั่ว" | "子-午" | "甲午"
 * value = { text, label?, category?, branches?, combos? } — ช่องที่ซินแสแก้/เพิ่มได้ในอนาคต
 */
export type NewdataValue = {
  text: string;
  label?: string;
  category?: string;
  branches?: string[];
  combos?: string[][];
};

export const baziNewdata = pgTable(
  "bazi_newdata",
  {
    groupKey: text("group_key").notNull(),
    itemKey: text("item_key").notNull(),
    ordinal: integer("ordinal").notNull().default(0),
    value: jsonb("value").$type<NewdataValue>().notNull(),
    sourceFile: text("source_file"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.groupKey, table.itemKey] })],
);

export type InsertBaziNewdata = typeof baziNewdata.$inferInsert;
export type SelectBaziNewdata = typeof baziNewdata.$inferSelect;

/**
 * "ดวงที่บันทึกไว้" ของ tab อ่าน 15 บท (NewData) — เปิดมาแก้/ปรินซ้ำข้ามเครื่องได้
 * edits = { boxes: { [chapterId]: {title,body}[] }, titles: { [chapterId]: title } }
 *   — override กล่อง (เพิ่ม/ลบ/แก้) + ชื่อบท เฉพาะที่ซินแสแก้
 */
export type NewdataReadingBox = { title: string; body: string };
export type NewdataReadingEdits = {
  boxes?: Record<string, NewdataReadingBox[]>;
  titles?: Record<string, string>;
};

export const baziNewdataReading = pgTable(
  "bazi_newdata_reading",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientName: text("client_name"),
    birthDate: text("birth_date").notNull(),
    birthTime: text("birth_time").notNull(),
    gender: text("gender").notNull(),
    province: text("province"),
    edits: jsonb("edits").$type<NewdataReadingEdits>().notNull().default({}),
    /** ป้ายเครื่องที่สร้าง/แก้ดวงนี้ (เช่น "เครื่องซินแส") — แยกงานซินแสจากเครื่องอื่น */
    deviceLabel: text("device_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
);

export type InsertBaziNewdataReading = typeof baziNewdataReading.$inferInsert;
export type SelectBaziNewdataReading = typeof baziNewdataReading.$inferSelect;

/**
 * "ประวัติการบันทึก" ของ tab อ่าน 15 บท (NewData) — สแน็ปช็อต edits ทุกครั้งที่กด "บันทึกดวงนี้"
 * insert-only เหมือน bazi_reading_session_revisions ของอ่านดวงหลัก → ย้อนเปิดดู/กู้คืนได้ (เก็บ ~30 ล่าสุด/ดวง)
 * ผูก FK ON DELETE CASCADE กับ bazi_newdata_reading
 */
export const baziNewdataReadingRevisions = pgTable("bazi_newdata_reading_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  readingId: uuid("reading_id")
    .notNull()
    .references(() => baziNewdataReading.id, { onDelete: "cascade" }),
  clientName: text("client_name"),
  birthDate: text("birth_date").notNull(),
  birthTime: text("birth_time").notNull(),
  gender: text("gender").notNull(),
  province: text("province"),
  edits: jsonb("edits").$type<NewdataReadingEdits>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertBaziNewdataReadingRevision = typeof baziNewdataReadingRevisions.$inferInsert;
export type SelectBaziNewdataReadingRevision = typeof baziNewdataReadingRevisions.$inferSelect;

/**
 * "เวอร์ชัน PDF" ของ tab อ่าน 15 บท (NewData) — สแน็ปช็อต edits ที่กด "บันทึกเวอร์ชัน PDF" เอง (ไม่ใช่ autosave)
 * ให้ทีม PDF บันทึกเวอร์ชันที่จัดหน้าเสร็จแยกจาก working edits + ย้อน/กู้ได้ (มิเรอร์ bazi_reading_pdf_versions)
 * insert-only · มี version_note · ผูก FK ON DELETE CASCADE กับดวงต้นทาง
 */
export const baziNewdataReadingPdfVersions = pgTable("bazi_newdata_reading_pdf_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  readingId: uuid("reading_id")
    .notNull()
    .references(() => baziNewdataReading.id, { onDelete: "cascade" }),
  clientName: text("client_name"),
  birthDate: text("birth_date").notNull(),
  birthTime: text("birth_time").notNull(),
  gender: text("gender").notNull(),
  province: text("province"),
  versionNote: text("version_note"),
  edits: jsonb("edits").$type<NewdataReadingEdits>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertBaziNewdataReadingPdfVersion = typeof baziNewdataReadingPdfVersions.$inferInsert;
export type SelectBaziNewdataReadingPdfVersion = typeof baziNewdataReadingPdfVersions.$inferSelect;

/**
 * รูปไพ่ "โหมดเซียน" (ไพ่จิตวิญญาณแดนสวรรค์) — สร้างล่วงหน้าด้วย Imagen เก็บ base64
 * cardNo = เลขไพ่ (PK) ตรงกับ divine-cards.json
 */
export const baziDivineCardImage = pgTable("bazi_divine_card_image", {
  cardNo: integer("card_no").primaryKey(),
  prompt: text("prompt").notNull(),
  /** URL รูปบน Supabase Storage (แหล่งหลัก) */
  imageUrl: text("image_url"),
  /** base64 (legacy / fallback) — nullable หลังย้ายไป Supabase */
  imageBase64: text("image_base64"),
  mime: text("mime").notNull().default("image/png"),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertBaziDivineCardImage = typeof baziDivineCardImage.$inferInsert;
export type SelectBaziDivineCardImage = typeof baziDivineCardImage.$inferSelect;

/**
 * รูปไพ่ "ไพ่ออราเคิลเคี้ยงคุง" — นำเข้าจากไฟล์จริง (JPEG ย่อ) เก็บ URL บน Supabase
 * cardNo = เลขไพ่ (PK) ตรงกับ oracle-cards.json
 */
export const baziOracleCardImage = pgTable("bazi_oracle_card_image", {
  cardNo: integer("card_no").primaryKey(),
  prompt: text("prompt").notNull(),
  /** URL รูปบน Supabase Storage (แหล่งหลัก) */
  imageUrl: text("image_url"),
  /** base64 (legacy / fallback) — nullable */
  imageBase64: text("image_base64"),
  mime: text("mime").notNull().default("image/jpeg"),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertBaziOracleCardImage = typeof baziOracleCardImage.$inferInsert;
export type SelectBaziOracleCardImage = typeof baziOracleCardImage.$inferSelect;

/**
 * รูป mascot 60 ดิถี — เลือกตามเสาวัน (60 กะจื่อ) แสดงหน้าอ่านดวง
 * ganzhi = เสาวัน เช่น "庚午" (PK) ตรงกับ MASCOT_60 ใน src/lib/bazi/mascot/mascot-60.ts
 * รูปจริงอยู่บน Supabase Storage — ตารางนี้เก็บ "ลิงก์" + ชื่อ
 */
export const baziMascotImage = pgTable("bazi_mascot_image", {
  ganzhi: text("ganzhi").primaryKey(),
  nameTh: text("name_th").notNull(),
  nameEn: text("name_en").notNull(),
  /** URL รูปบน Supabase Storage (แหล่งหลัก) */
  imageUrl: text("image_url"),
  mime: text("mime").notNull().default("image/png"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertBaziMascotImage = typeof baziMascotImage.$inferInsert;
export type SelectBaziMascotImage = typeof baziMascotImage.$inferSelect;

/** ค่าคำทำนาย Matching (จับคู่/สมพงษ์) — text หลัก + label ไม่บังคับ */
export type MatchingValue = {
  text: string;
  label?: string;
};

/**
 * คำทำนายหน้าจับคู่ (Matching) — ซินแสแก้ได้ live เหมือน bazi_newdata
 * group_key = ชุด (nisai_stem / role_partner / sising_work ...) · item_key = คีย์ในชุด (ก้าน/ราศี/เชี่ยงแซ/โค้ด A?/B?)
 * overlay ทับ reference.json + sising.json ตอน engine อ่าน (ช่องว่าง = ใช้ค่า JSON เดิม)
 */
export const baziMatching = pgTable(
  "bazi_matching",
  {
    groupKey: text("group_key").notNull(),
    itemKey: text("item_key").notNull(),
    ordinal: integer("ordinal").notNull().default(0),
    value: jsonb("value").$type<MatchingValue>().notNull(),
    sourceFile: text("source_file"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.groupKey, table.itemKey] })],
);

export type InsertBaziMatching = typeof baziMatching.$inferInsert;
export type SelectBaziMatching = typeof baziMatching.$inferSelect;

export type InsertBaziDatasetRecord = typeof baziDatasetRecords.$inferInsert;
export type SelectBaziDatasetRecord = typeof baziDatasetRecords.$inferSelect;
export type InsertBaziCanonicalSource = typeof baziCanonicalSources.$inferInsert;
export type InsertBaziReferenceDocument = typeof baziReferenceDocuments.$inferInsert;
export type InsertBaziCanonicalRawRow = typeof baziCanonicalRawRows.$inferInsert;
export type InsertBaziTimeSolarTerm = typeof baziTimeSolarTerms.$inferInsert;
export type InsertBaziFaqTaxonomy = typeof baziFaqTaxonomies.$inferInsert;
export type InsertBaziElementInteraction = typeof baziElementInteractions.$inferInsert;
export type InsertBaziTwelveQiStage = typeof baziTwelveQiStages.$inferInsert;
export type InsertBaziDayMasterProfile = typeof baziDayMasterProfiles.$inferInsert;
export type InsertBaziDayMasterStrengthState = typeof baziDayMasterStrengthStates.$inferInsert;
export type InsertBaziSixtyJiaziNarrative = typeof baziSixtyJiaziNarratives.$inferInsert;
export type InsertBaziDomainMatrix = typeof baziDomainMatrices.$inferInsert;
export type InsertUserLineMapping = typeof userLineMappings.$inferInsert;
export type SelectUserLineMapping = typeof userLineMappings.$inferSelect;
export type InsertBaziChatHistory = typeof baziChatHistories.$inferInsert;

/**
 * ดวงลูกค้าที่บันทึกไว้ (Man Vs Day / ดวงกับวัน) — เก็บ birth input เพื่อเรียกกลับมาดู
 * ปฏิทินส่วนตัว/สั่ง PDF ซ้ำได้ โดยไม่ต้องป้อนวันเกิดใหม่ทุกครั้ง.
 */
export const baziSavedChart = pgTable("bazi_saved_chart", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull(),
  rawInput: jsonb("raw_input").$type<RawInputValue>().notNull(),
  /** หลักวัน (เช่น 己酉) เก็บไว้โชว์ในรายการ — optional */
  dayMaster: text("day_master"),
  ownerId: text("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertBaziSavedChart = typeof baziSavedChart.$inferInsert;
export type SelectBaziSavedChart = typeof baziSavedChart.$inferSelect;
export type SelectBaziChatHistory = typeof baziChatHistories.$inferSelect;

/**
 * บันทึกการใช้งาน + โทเคน API ต่อ 1 คำถาม–คำตอบ ของแชท "โค้ชฮีลใจ" (Louise Hay)
 * เก็บ breakdown โทเคนแยกตามการเรียก API 3 จุด (classify / embed / generate) เพื่อคำนวณ
 * ต้นทุน (USD/THB) ในหน้าแดชบอร์ด และทำสถิติรายผู้ใช้ (anon id / วันเกิดที่ผูก).
 * ต้นทุนไม่เก็บเป็นคอลัมน์ — คำนวณจาก token + model ตอนแสดงผล (แก้ราคาย้อนหลังได้).
 */
export const louiseHayUsage = pgTable(
  "louise_hay_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** id นิรนามจาก localStorage ของเบราว์เซอร์ (นับ "คน") */
    anonId: text("anon_id").notNull(),
    /** คีย์ดวงที่ผูก (เช่น "1988-05-20|กรุงเทพมหานคร") — null ถ้าไม่ผูกดวง */
    birthKey: text("birth_key"),
    question: text("question").notNull(),
    /** ตัวอย่างคำตอบ (ตัดสั้น) ไว้ดูย้อนหลัง */
    answerPreview: text("answer_preview"),
    /** ศาสตร์ที่ระบบเลือกตอบ: chart / day / card / chat */
    route: text("route").notNull(),
    /** โมเดลหลักที่ใช้เขียนคำตอบ */
    model: text("model").notNull(),
    /** ผู้ใช้กรอกคีย์ Gemini ของตัวเอง → ต้นทุนไม่ตกที่ระบบ */
    usedOwnKey: boolean("used_own_key").notNull().default(false),
    // ── token breakdown ต่อการเรียก API แต่ละจุด ──
    classifyInTokens: integer("classify_in_tokens").notNull().default(0),
    classifyOutTokens: integer("classify_out_tokens").notNull().default(0),
    embedTokens: integer("embed_tokens").notNull().default(0),
    genInTokens: integer("gen_in_tokens").notNull().default(0),
    genOutTokens: integer("gen_out_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("louise_hay_usage_anon_idx").on(table.anonId),
    index("louise_hay_usage_created_idx").on(table.createdAt),
  ],
);

export type InsertLouiseHayUsage = typeof louiseHayUsage.$inferInsert;
export type SelectLouiseHayUsage = typeof louiseHayUsage.$inferSelect;

/**
 * การเตือน "วันโชคดี/วันควรระวัง" ที่ผู้ใช้ตั้งไว้จาก LIFF → push ผ่าน LINE เมื่อถึงวัน.
 * 1 แถว = 1 การเตือน; cron รายวันดึงแถว status='pending' ที่ targetDate = วันนี้ (Asia/Bangkok) มา push.
 */
export const baziAlerts = pgTable(
  "bazi_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** LINE userId ผู้รับ (ได้จากการ verify id_token ของ LIFF) */
    lineUserId: text("line_user_id").notNull(),
    /** วันที่จะเตือน "YYYY-MM-DD" อิงโซนเวลา Asia/Bangkok (เก็บเป็น text ให้เทียบวันตรง ๆ ไม่ยุ่ง tz) */
    targetDate: text("target_date").notNull(),
    /** ชนิด: luck (วันโชคดี) / caution (วันควรระวัง) / custom */
    kind: text("kind").notNull(),
    /** ข้อความที่จะ push (เตรียมไว้ตอนตั้ง — ตอนถึงวันแค่ส่งออก) */
    message: text("message").notNull(),
    /** คีย์ดวงที่ผูก (อ้างอิง/กันซ้ำ) — null ได้ */
    birthKey: text("birth_key"),
    /** pending → รอส่ง, sent → ส่งแล้ว, canceled → ผู้ใช้ยกเลิก */
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    // cron ดึงแถวครบกำหนดวันนี้เร็ว ๆ
    index("bazi_alerts_due_idx").on(table.status, table.targetDate),
    index("bazi_alerts_user_idx").on(table.lineUserId),
  ],
);

export type InsertBaziAlert = typeof baziAlerts.$inferInsert;
export type SelectBaziAlert = typeof baziAlerts.$inferSelect;

/**
 * บันทึกโทเคน/ต้นทุน LLM ต่อ 1 การเรียก สำหรับฟีเจอร์อื่น ๆ ที่ใช้ LLM (แยกตารางตามฟีเจอร์
 * ตามที่เลือกไว้) — แต่ทุกตารางใช้ "โครงคอลัมน์เดียวกัน" ผ่าน factory ด้านล่าง เพื่อให้แดชบอร์ด
 * /stats รวมข้อมูลข้ามตารางได้ง่าย. ต้นทุนไม่เก็บเป็นคอลัมน์ — คำนวณจาก provider+model+token
 * ตอนแสดงผล (แก้ราคาย้อนหลังได้).
 */
function llmUsageColumns() {
  return {
    id: uuid("id").defaultRandom().primaryKey(),
    /** ผู้ให้บริการ: gemini / anthropic / opencode */
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inTokens: integer("in_tokens").notNull().default(0),
    outTokens: integer("out_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    /** บริบทของงาน เช่น topicId / ชื่อไพ่ / คำถาม — ไว้ดูว่า "ทำอะไร" */
    label: text("label"),
    /** ผู้ใช้/ดวงที่เกี่ยวข้อง (ถ้ามี) — งานฝั่งแอดมินมักเป็น null */
    anonId: text("anon_id"),
    /** ใช้คีย์ของผู้ใช้เอง → ต้นทุนไม่ตกที่ระบบ */
    usedOwnKey: boolean("used_own_key").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  };
}

export const readingTopicUsage = pgTable("reading_topic_usage", llmUsageColumns());
export const divineCardsUsage = pgTable("divine_cards_usage", llmUsageColumns());
export const oracleCardsUsage = pgTable("oracle_cards_usage", llmUsageColumns());
export const honeycombUsage = pgTable("honeycomb_usage", llmUsageColumns());
export const pairRephraseUsage = pgTable("pair_rephrase_usage", llmUsageColumns());
export const readingDraftUsage = pgTable("reading_draft_usage", llmUsageColumns());
// ฟีเจอร์ narrate กลาง (/api/bazi/narrate) — เกลาผล engine ด้วย AI
export const fortuneSageUsage = pgTable("fortune_sage_usage", llmUsageColumns());
export const almanacUsage = pgTable("almanac_usage", llmUsageColumns());
export const manVsDayUsage = pgTable("man_vs_day_usage", llmUsageColumns());
export const phoneReadingUsage = pgTable("phone_reading_usage", llmUsageColumns());
export const reactionChamberUsage = pgTable("reaction_chamber_usage", llmUsageColumns());

/** ตารางฟีเจอร์ LLM ทั้งหมด (นอกจาก louise_hay ที่มีโครงเฉพาะ) — dashboard วนอ่านทีละตัว */
export const LLM_USAGE_TABLES = {
  reading_topic: readingTopicUsage,
  divine_cards: divineCardsUsage,
  oracle_cards: oracleCardsUsage,
  honeycomb: honeycombUsage,
  pair_rephrase: pairRephraseUsage,
  reading_draft: readingDraftUsage,
  fortune_sage: fortuneSageUsage,
  almanac: almanacUsage,
  man_vs_day: manVsDayUsage,
  phone_reading: phoneReadingUsage,
  reaction_chamber: reactionChamberUsage,
} as const;

export type LlmUsageFeature = keyof typeof LLM_USAGE_TABLES;
export type InsertLlmUsage = typeof readingTopicUsage.$inferInsert;
export type SelectLlmUsage = typeof readingTopicUsage.$inferSelect;

/**
 * Sacred Map — สถานที่มู/ไหว้เทพ verified (Section 5 ของ PRD Mumate).
 * 1 แถว = 1 สถานที่. แอดมินเพิ่ม/แก้/verify; ผู้ใช้เสนอเข้ามาได้ (status='pending', source='user').
 * Save/check-in/ตั้งเตือน ฝั่งผู้ใช้เก็บใน localStorage (ยังไม่ผูก LINE login) — คอลัมน์ checkinCount
 * เก็บยอดเช็คอินรวมแบบนิรนามไว้โชว์ความนิยม.
 */
export const baziSacredMapLocation = pgTable(
  "bazi_sacred_map_location",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** ชื่อสถานที่ เช่น "ศาลเจ้าพ่อเสือ" */
    name: text("name").notNull(),
    /** สิ่งศักดิ์สิทธิ์/เทพประจำสถานที่ เช่น "เจ้าพ่อเสือ (ตั่วเหล่าเอี๊ย)" */
    deity: text("deity"),
    /** คำอธิบายสถานที่ */
    description: text("description"),
    province: text("province"),
    address: text("address"),
    /** พิกัดสำหรับปักหมุดบนแผนที่ */
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    /** ทิศมงคลของสถานที่ เช่น "ทิศเหนือ" (แสดงใน sheet) */
    direction: text("direction"),
    /** ธาตุที่เกี่ยวข้อง (wood/fire/earth/metal/water) — ใช้กรอง + สี pin */
    element: text("element"),
    /** ความต้องการที่สถานที่นี้ช่วย เช่น ["การงาน","เงิน"] — ใช้กรอง */
    needs: jsonb("needs").$type<string[]>().notNull().default([]),
    /** โพยการมู — ของไหว้/วิธีขอพร */
    worshipGuide: text("worship_guide"),
    imageUrl: text("image_url"),
    /** ลิงก์ Google Maps เฉพาะ (ถ้าเว้นว่าง จะสร้างจาก lat/lng) */
    googleMapUrl: text("google_map_url"),
    /** ยอดเช็คอินรวม (นิรนาม) */
    checkinCount: integer("checkin_count").notNull().default(0),
    /** pending → รอ verify, verified → โชว์สาธารณะ, rejected → ซ่อน */
    status: text("status").notNull().default("pending"),
    /** admin → แอดมินเพิ่มเอง, user → ผู้ใช้เสนอ */
    source: text("source").notNull().default("admin"),
    /** ช่องทางติดต่อผู้เสนอ (สำหรับ submission ของผู้ใช้) — null ได้ */
    submitterContact: text("submitter_contact"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("bazi_sacred_map_status_idx").on(table.status),
    index("bazi_sacred_map_element_idx").on(table.element),
  ],
);

export type InsertBaziSacredMapLocation = typeof baziSacredMapLocation.$inferInsert;
export type SelectBaziSacredMapLocation = typeof baziSacredMapLocation.$inferSelect;