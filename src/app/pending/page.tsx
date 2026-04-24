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

type PendingPageProps = {
  searchParams?: Promise<{
    campaign?: string;
  }>;
};

function createPendingReturnPath(campaignLabel?: string) {
  if (!campaignLabel) {
    return "/pending";
  }

  const params = new URLSearchParams({ campaign: campaignLabel });
  return `/pending?${params.toString()}`;
}

export default async function PendingPage({ searchParams }: PendingPageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const campaignLabel = resolvedSearchParams?.campaign?.trim() || undefined;
  const records = await listDraftDatasetRecords({ campaignLabel });

  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={pendingQueueStatusCopy} />
      <PendingDraftQueue
        records={records}
        campaignLabel={campaignLabel}
        returnToPath={createPendingReturnPath(campaignLabel)}
      />
    </main>
  );
}