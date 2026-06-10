import {
  createDeleteReadingSessionHandler,
  createGetReadingSessionHandler,
} from "@/lib/bazi/reading-sessions";

export const GET = createGetReadingSessionHandler({});
export const DELETE = createDeleteReadingSessionHandler({});
