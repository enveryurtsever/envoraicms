/** Shown instantly while a server component renders. Matches the admin shell
 *  spacing so the layout doesn't jump when the real content swaps in. */
export default function AdminLoading() {
  return (
    <>
      <div className="admin-header">
        <div>
          <div className="adm-skel adm-skel-title" />
          <div className="adm-skel adm-skel-sub" />
        </div>
      </div>

      <div className="card">
        <div className="adm-skel adm-skel-row" />
        <div className="adm-skel adm-skel-row" />
        <div className="adm-skel adm-skel-row" style={{ width: "75%" }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb" }}>
          <div className="adm-skel adm-skel-row" style={{ width: "40%" }} />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              padding: "0.85rem 1rem",
              borderBottom: i < 4 ? "1px solid #f1f5f9" : "none",
              display: "grid",
              gridTemplateColumns: "60px 1fr 120px 120px 90px",
              gap: "0.75rem",
              alignItems: "center",
            }}
          >
            <div className="adm-skel adm-skel-cell" />
            <div className="adm-skel adm-skel-cell" />
            <div className="adm-skel adm-skel-cell" />
            <div className="adm-skel adm-skel-cell" />
            <div className="adm-skel adm-skel-cell" />
          </div>
        ))}
      </div>
    </>
  );
}
