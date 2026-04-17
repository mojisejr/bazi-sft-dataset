import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { ProofWorkspace } from "@/components/bazi/ProofWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";
import { getProofDatasetRecord } from "@/lib/bazi/dataset-records";

type ProofWorkspaceHookPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const proofHookStatusCopy = {
  tone: "ready",
  label: "กำลังตรวจทานคำทำนาย AI",
  detail:
    "เปิดรายละเอียดดวง แก้ไขคำอธิบายทั้ง 15 มิติ แล้วเลือกอนุมัติหรือตีกลับพร้อมเหตุผลได้ในหน้าเดียว",
} as const;

export default async function ProofWorkspaceHookPage({
  params,
}: ProofWorkspaceHookPageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const record = await getProofDatasetRecord(id);

  if (!record || record.status === "exported") {
    notFound();
  }

  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={proofHookStatusCopy} />
      <ProofWorkspace record={record} />
    </main>
  );
}