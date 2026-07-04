import { SystemHeader } from "@/components/bazi/SystemHeader";
import { LouiseHayChat } from "@/components/louise-hay/LouiseHayChat";

export const metadata = {
  title: "โค้ชฮีลใจ — แชทรักและเยียวยาตัวเอง",
  description: "แชทบอตให้กำลังใจสไตล์ Louise Hay (mockup)",
};

export default function LouiseHayPage() {
  return (
    <>
    <SystemHeader />
    <main className="lh-page">
      <header className="lh-hero">
        <div className="lh-hero__badge">mockup · ยังไม่ต่อ LINE</div>
        <h1 className="lh-hero__title">โค้ชฮีลใจ 💗</h1>
        <p className="lh-hero__subtitle">
          พื้นที่ปลอดภัยสำหรับพักใจ — น้ำเสียงและคำสอนถอดแบบจากหนังสือของ Louise Hay
        </p>
      </header>
      <LouiseHayChat />
      <p style={{ textAlign: "center", margin: 0 }}>
        <a href="/stats" style={{ fontSize: 13, color: "#e6337f", textDecoration: "none" }}>
          📊 สถิติ &amp; ต้นทุน API
        </a>
      </p>
      <p className="lh-disclaimer">
        โค้ชฮีลใจเป็นเพื่อนให้กำลังใจ ไม่ใช่แพทย์หรือนักจิตบำบัด · หากอยู่ในภาวะวิกฤต
        โทรสายด่วนสุขภาพจิต 1323 (ฟรี 24 ชม.)
      </p>
    </main>
    </>
  );
}
