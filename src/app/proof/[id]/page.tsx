import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { ProofWorkspace } from "@/components/bazi/ProofWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";
import { getProofDatasetRecord } from "@/lib/bazi/dataset-records";

type ProofWorkspaceHookPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    returnTo?: string;
  }>;
};

function resolveReturnToPath(candidate?: string) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/?workspace=queue";
  }

  return candidate;
}

const proofHookStatusCopy = {
  tone: "ready",
  label: "กำลังตรวจทานคำทำนาย AI",
  detail:
    "เปิดรายละเอียดดวง แก้ไขคำอธิบายทั้ง 15 มิติ แล้วเลือกอนุมัติหรือตีกลับพร้อมเหตุผลได้ในหน้าเดียว",
} as const;

export default async function ProofWorkspaceHookPage({
  params,
  searchParams,
}: ProofWorkspaceHookPageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const record = await getProofDatasetRecord(id);
  const returnToPath = resolveReturnToPath(resolvedSearchParams.returnTo);

  if (!record || record.status === "exported") {
    notFound();
  }

  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={proofHookStatusCopy} />
      <ProofWorkspace record={record} returnToPath={returnToPath} />
    </main>
  );
}