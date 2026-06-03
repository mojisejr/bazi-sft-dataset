ALTER TABLE "bazi_chat_histories" ADD COLUMN "thread_id" text;--> statement-breakpoint
ALTER TABLE "bazi_chat_histories" DROP CONSTRAINT IF EXISTS "bazi_chat_histories_clerk_user_id_unique";--> statement-breakpoint
ALTER TABLE "bazi_chat_histories" ADD CONSTRAINT "bazi_chat_histories_clerk_user_id_thread_id_unique" UNIQUE("clerk_user_id","thread_id");