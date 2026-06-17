import {
  createListReadingPdfVersionsHandler,
  createSaveReadingPdfVersionHandler,
} from "@/lib/bazi/reading-pdf-versions";

export const GET = createListReadingPdfVersionsHandler({});
export const POST = createSaveReadingPdfVersionHandler({});
