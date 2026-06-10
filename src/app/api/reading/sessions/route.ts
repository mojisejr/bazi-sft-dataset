import {
  createListReadingSessionsHandler,
  createSaveReadingSessionHandler,
} from "@/lib/bazi/reading-sessions";

export const GET = createListReadingSessionsHandler({});
export const POST = createSaveReadingSessionHandler({});
