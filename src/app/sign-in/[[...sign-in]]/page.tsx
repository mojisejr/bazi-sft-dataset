import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="trainer-page auth-shell">
      <section className="surface auth-card">
        <div className="auth-intro">
          <p className="section-kicker">เข้าถึงระบบ</p>
          <h1>เข้าสู่ระบบเพื่อเปิด Bazi Trainer</h1>
          <p>
            พื้นที่นี้เปิดให้เฉพาะ operator ที่ได้รับสิทธิ์ผ่าน Google SSO และถูกอนุมัติไว้ใน
            Clerk เท่านั้น
          </p>
        </div>

        <div className="auth-panel">
          <SignIn />
        </div>
      </section>
    </main>
  );
}