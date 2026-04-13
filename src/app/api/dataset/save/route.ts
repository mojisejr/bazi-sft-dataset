import { auth } from "@clerk/nextjs/server";

import { createSaveDatasetHandler } from "@/lib/bazi/dataset-records";

export const POST = createSaveDatasetHandler({ authenticate: auth });