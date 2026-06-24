import {
  createDeleteReadingSessionRevisionHandler,
  createGetReadingSessionRevisionHandler,
} from "@/lib/bazi/reading-session-revisions";

export const GET = createGetReadingSessionRevisionHandler({});
export const DELETE = createDeleteReadingSessionRevisionHandler({});
