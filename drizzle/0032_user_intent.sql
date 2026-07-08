CREATE TABLE IF NOT EXISTS "bazi_user_intent" (
  "anon_id" text PRIMARY KEY,
  "focus" text[] NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
