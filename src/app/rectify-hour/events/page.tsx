// สอบยาม v2 (event-based) internal page — thin route mounting the self-contained events experience
// (#hour-rectification-engine). No data fetching here; the client component talks to
// /api/bazi/rectify-hour/events directly. Separate route from the v1 quiz page so deleting the v2
// files restores the repo.
import { RectifyByEventsExperience } from "@/lib/bazi/hour-rectification/ui/RectifyByEventsExperience";

export const metadata = {
  title: "สอบยามจากเหตุการณ์ชีวิต · internal",
};

export default function RectifyHourEventsPage() {
  return (
    <main className="page-shell rectify-hour-page">
      <RectifyByEventsExperience />
    </main>
  );
}
