import {
  createDeleteNewdataReadingRevisionHandler,
  createGetNewdataReadingRevisionHandler,
} from "@/lib/bazi/newdata-reading-revisions";

export const GET = createGetNewdataReadingRevisionHandler();
export const DELETE = createDeleteNewdataReadingRevisionHandler();
