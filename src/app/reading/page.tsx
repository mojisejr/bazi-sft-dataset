import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ReadingPathWorkspace } from "@/components/bazi/reading/ReadingPathWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default async function ReadingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "Stepwise Path Reading",
          detail: "อ่านดวงทีละหัวข้อจาก engine truth พร้อมเลือกเรียบเรียงด้วย LLM",
        }}
      />
      <ReadingPathWorkspace />
    </main>
  );
}
