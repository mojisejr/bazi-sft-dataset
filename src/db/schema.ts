import { sql } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const scaffoldStageEnum = pgEnum("scaffold_stage", [
  "scaffolded",
  "phase_1_pending",
]);

export const scaffoldMetadata = pgTable("scaffold_metadata", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectSlug: text("project_slug").notNull().unique(),
  status: scaffoldStageEnum("status").notNull().default("scaffolded"),
  notes: jsonb("notes")
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});