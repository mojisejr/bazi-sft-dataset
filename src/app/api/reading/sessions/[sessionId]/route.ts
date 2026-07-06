import {
  createDeleteReadingSessionHandler,
  createGetReadingSessionHandler,
  createSetReadingSessionStatusHandler,
} from "@/lib/bazi/reading-sessions";

export const GET = createGetReadingSessionHandler({});
export const DELETE = createDeleteReadingSessionHandler({});
export const PATCH = createSetReadingSessionStatusHandler({});
