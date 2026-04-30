export default function InstallLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc, #e2e8f0)",
        padding: "40px 20px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: 8,
          }}
        >
          ENVORAICMS Setup
        </h1>
        <p style={{ color: "#475569", marginBottom: 24 }}>
          This wizard prepares the database, stores base settings, and creates your
          admin account.
        </p>
        {children}
      </div>
    </div>
  );
}
