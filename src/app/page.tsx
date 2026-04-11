const checklist = [
  "Next.js App Router scaffold is in place.",
  "Drizzle config and Neon client helpers are wired.",
  "Vitest is ready for deterministic checks.",
  "Phase 1 can now focus on the real bazi_dataset_records schema.",
];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Phase 0.5</p>
        <h1>Bazi Scaffold Is Ready</h1>
        <p className="lede">
          This foundation keeps infrastructure concerns separate from the real
          schema design that belongs to Phase 1.
        </p>
      </section>

      <section className="panel">
        <h2>What Landed</h2>
        <ul className="checklist">
          {checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}