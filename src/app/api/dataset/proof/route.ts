import { auth } from "@clerk/nextjs/server";

import { createSaveProofDatasetHandler } from "@/lib/bazi/dataset-records";

export const POST = createSaveProofDatasetHandler({ authenticate: auth });