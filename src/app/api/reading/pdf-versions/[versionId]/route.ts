import {
  createDeleteReadingPdfVersionHandler,
  createGetReadingPdfVersionHandler,
} from "@/lib/bazi/reading-pdf-versions";

export const GET = createGetReadingPdfVersionHandler({});
export const DELETE = createDeleteReadingPdfVersionHandler({});
