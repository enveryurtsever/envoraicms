/** Reusable shimmer skeletons for instant-shell admin pages.
 *  Each component matches the rough dimensions of the real UI it stands in
 *  for so the swap-in doesn't shift layout. */

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb", display: "flex", gap: 12 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="adm-skel" style={{ height: 12, flex: i === 1 ? 2 : 1, borderRadius: 4 }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            padding: "0.85rem 1rem",
            borderBottom: r < rows - 1 ? "1px solid #f1f5f9" : "none",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="adm-skel"
              style={{ height: 14, flex: c === 1 ? 2 : 1, borderRadius: 4 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card">
      <div className="adm-skel adm-skel-title" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="adm-skel adm-skel-row" style={{ width: i === rows - 1 ? "70%" : "100%" }} />
      ))}
    </div>
  );
}

export function FormSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "200px 1fr",
            gap: 16,
            padding: "0.75rem 0",
            borderBottom: i < rows - 1 ? "1px solid #f1f5f9" : "none",
          }}
        >
          <div className="adm-skel" style={{ height: 12, width: "60%", borderRadius: 4 }} />
          <div className="adm-skel" style={{ height: 32, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

export function FilterBarSkeleton() {
  return (
    <div
      className="card"
      style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.5rem 0.75rem" }}
    >
      <div className="adm-skel" style={{ height: 32, width: 160, borderRadius: 6 }} />
      <div className="adm-skel" style={{ height: 32, flex: 1, borderRadius: 6 }} />
      <div className="adm-skel" style={{ height: 32, width: 80, borderRadius: 6 }} />
    </div>
  );
}
