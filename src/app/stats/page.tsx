import { SystemHeader } from "@/components/bazi/SystemHeader";
import { StatsDashboard } from "@/components/stats/StatsDashboard";

export const metadata = {
  title: "สถิติ & ต้นทุน API (ทุกฟีเจอร์)",
  description: "แดชบอร์ดโทเคน ต้นทุน API และสถิติการใช้ LLM ทุกฟีเจอร์",
};

export default function StatsPage() {
  return (
    <>
      <SystemHeader />
      <main className="stats-page">
        <header className="stats-hero">
          <h1 className="stats-title">สถิติ &amp; ต้นทุน API 📊</h1>
          <p className="stats-sub">
            โทเคนและค่า API ที่ใช้จริงต่อการเรียก LLM · รวมทุกฟีเจอร์ (อ่านดวง · ไพ่ · โค้ชฮีลใจ · สร้างรูป ฯลฯ)
          </p>
        </header>
        <StatsDashboard />
      </main>
    </>
  );
}
