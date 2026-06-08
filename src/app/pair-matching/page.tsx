import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { PairMatchingWorkspace } from "@/components/bazi/pair/PairMatchingWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default async function PairMatchingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "เปรียบเทียบดวง 2 คน · คู่สมพงษ์",
          detail: "จับคู่หลักวันแบบแม่นตามตำรา ทั้งการงานและความรัก พร้อมเรียบเรียงด้วย LLM",
        }}
      />
      <PairMatchingWorkspace />
    </main>
  );
}
