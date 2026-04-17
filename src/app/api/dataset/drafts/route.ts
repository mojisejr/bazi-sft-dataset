import { auth } from "@clerk/nextjs/server";

import { createListDraftDatasetRecordsHandler } from "@/lib/bazi/dataset-records";

export const GET = createListDraftDatasetRecordsHandler({ authenticate: auth });