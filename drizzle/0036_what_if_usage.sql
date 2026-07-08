CREATE TABLE IF NOT EXISTS "what_if_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "in_tokens" integer NOT NULL DEFAULT 0,
  "out_tokens" integer NOT NULL DEFAULT 0,
  "total_tokens" integer NOT NULL DEFAULT 0,
  "label" text,
  "anon_id" text,
  "used_own_key" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
