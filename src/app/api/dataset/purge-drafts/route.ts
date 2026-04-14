import { auth } from "@clerk/nextjs/server";

import { createPurgeDatasetDraftsHandler } from "@/lib/bazi/dataset-records";

export const POST = createPurgeDatasetDraftsHandler({ authenticate: auth });