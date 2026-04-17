import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { PendingDraftQueue } from "@/components/bazi/PendingDraftQueue";
import { SystemHeader } from "@/components/bazi/SystemHeader";
import { listDraftDatasetRecords } from "@/lib/bazi/dataset-records";

export const pendingQueueStatusCopy = {
  tone: "ready",
  label: "มี draft รอซินแสตรวจ",
  detail:
    "หน้านี้แสดงเคสที่ AI generate เข้ามาแล้วในสถานะ draft เพื่อให้เปิดเข้าสู่ proofing workspace ได้ทันที",
} as const;

export default async function PendingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const records = await listDraftDatasetRecords();

  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={pendingQueueStatusCopy} />
      <PendingDraftQueue records={records} />
    </main>
  );
}