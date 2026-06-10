import { ReadingPathWorkspace } from "@/components/bazi/reading/ReadingPathWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

type ReadingPageProps = {
  searchParams?: Promise<{
    session?: string;
    print?: string;
  }>;
};

export default async function ReadingPage({ searchParams }: ReadingPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const resumeSessionId = resolvedSearchParams?.session?.trim() || undefined;
  const autoPrint = resolvedSearchParams?.print === "1";

  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "Stepwise Path Reading",
          detail: "อ่านดวงทีละหัวข้อจาก engine truth พร้อมเลือกเรียบเรียงด้วย LLM",
        }}
      />
      <ReadingPathWorkspace resumeSessionId={resumeSessionId} autoPrint={autoPrint} />
    </main>
  );
}
