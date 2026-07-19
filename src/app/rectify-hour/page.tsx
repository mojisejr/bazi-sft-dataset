// สอบยาม (Hour Rectification) internal page — thin route that just mounts the self-contained
// experience component (#hour-rectification-engine). No data fetching here; the client component
// talks to /api/bazi/rectify-hour directly. Kept deliberately minimal so deleting the ui/ folder +
// this file + the feature CSS restores the repo exactly (spec's self-contained requirement).
import { RectifyHourExperience } from "@/lib/bazi/hour-rectification/ui/RectifyHourExperience";

export const metadata = {
  title: "สอบยาม (Hour Rectification) · internal",
};

export default function RectifyHourPage() {
  return (
    <main className="page-shell rectify-hour-page">
      <RectifyHourExperience />
      {/* v2 entry (additive) — event-based lane, standalone from this quiz. */}
      <p className="rectify-hour__v2-entry">
        รู้ปีเหตุการณ์สำคัญ (แต่งงาน/เปลี่ยนงาน/มีบุตร…)?{" "}
        <a href="/rectify-hour/events">ลองสอบยามจากเหตุการณ์ →</a>
      </p>
    </main>
  );
}
