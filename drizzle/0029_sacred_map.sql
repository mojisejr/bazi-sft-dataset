CREATE TABLE IF NOT EXISTS "bazi_sacred_map_location" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "deity" text,
  "description" text,
  "province" text,
  "address" text,
  "lat" double precision NOT NULL,
  "lng" double precision NOT NULL,
  "direction" text,
  "element" text,
  "needs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "worship_guide" text,
  "image_url" text,
  "google_map_url" text,
  "checkin_count" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "source" text DEFAULT 'admin' NOT NULL,
  "submitter_contact" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_sacred_map_status_idx" ON "bazi_sacred_map_location" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_sacred_map_element_idx" ON "bazi_sacred_map_location" ("element");
