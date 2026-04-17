import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { SystemHeader } from "@/components/bazi/SystemHeader";

type ProofWorkspaceHookPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const proofHookStatusCopy = {
  tone: "busy",
  label: "กำลังต่อ Phase 5 proofing workspace",
  detail:
    "navigation hook พร้อมแล้วจาก pending queue แต่หน้าแก้ไข 15 มิติและ approve gate จะถูกลงเต็มใน Phase 5",
} as const;

export default async function ProofWorkspaceHookPage({
  params,
}: ProofWorkspaceHookPageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={proofHookStatusCopy} />

      <section className="workspace-stack">
        <section className="surface inset-card message-card">
          <p className="section-kicker">Proof Hook</p>
          <h2>เปิด navigation hook สำเร็จแล้ว</h2>
          <p>
            Record `{id}` ถูกส่งต่อมาจาก pending queue แล้ว แต่รายละเอียด split-pane,
            15 dimensions, และ `sinsaeProofNote` gate จะถูกลงใน Phase 5
          </p>
          <div className="message-card__actions">
            <Link className="secondary-action pending-link" href="/pending">
              กลับไป Pending Queue
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}