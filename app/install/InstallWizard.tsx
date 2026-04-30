"use client";

import { useEffect, useState } from "react";

type Step = "precheck" | "site" | "admin" | "run" | "done";

type StepLog = { name: string; ok: boolean; message?: string };

type RunResponse = {
  ok?: boolean;
  steps?: StepLog[];
  error?: string;
  message?: string;
};

const box: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 24,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const label: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: "0.85rem",
  color: "#334155",
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: "0.95rem",
};

const btn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 6,
  border: "none",
  background: "#0ea5e9",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  ...btn,
  background: "#e2e8f0",
  color: "#334155",
};

export function InstallWizard({ dbConfigPresent }: { dbConfigPresent: boolean }) {
  const [step, setStep] = useState<Step>("precheck");
  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [description, setDescription] = useState("");

  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPassword2, setAdminPassword2] = useState("");

  const [logs, setLogs] = useState<StepLog[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [precheckState, setPrecheckState] = useState<"idle" | "running" | "ok" | "fail">(
    dbConfigPresent ? "running" : "fail",
  );
  const [precheckMessage, setPrecheckMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!dbConfigPresent) {
      setPrecheckMessage("DB_HOST/DB_NAME/DB_USER/DB_PASSWORD missing in .env.local.");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/install/precheck", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; message?: string }
          | null;
        if (cancelled) return;
        if (res.ok && data?.ok) {
          setPrecheckState("ok");
          setStep("site");
        } else {
          setPrecheckState("fail");
          setPrecheckMessage(data?.message ?? `Connection error (${res.status})`);
        }
      } catch (e) {
        if (cancelled) return;
        setPrecheckState("fail");
        setPrecheckMessage(e instanceof Error ? e.message : "Unexpected error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbConfigPresent]);

  async function retryPrecheck() {
    setPrecheckState("running");
    setPrecheckMessage(null);
    try {
      const res = await fetch("/api/install/precheck", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (res.ok && data?.ok) {
        setPrecheckState("ok");
        setStep("site");
      } else {
        setPrecheckState("fail");
        setPrecheckMessage(data?.message ?? `Connection error (${res.status})`);
      }
    } catch (e) {
      setPrecheckState("fail");
      setPrecheckMessage(e instanceof Error ? e.message : "Unexpected error");
    }
  }

  const canGoSite = siteName.trim().length >= 2 && /^https?:\/\//i.test(siteUrl.trim());
  const canGoAdmin =
    /^[^@]+@[^@]+\.[^@]+$/.test(adminEmail.trim()) &&
    adminName.trim().length >= 2 &&
    adminPassword.length >= 8 &&
    adminPassword === adminPassword2;

  async function runInstall() {
    setSubmitting(true);
    setError(null);
    setLogs([]);
    setStep("run");
    try {
      const res = await fetch("/api/install/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: { siteName, siteUrl, description },
          admin: {
            email: adminEmail,
            name: adminName,
            password: adminPassword,
          },
        }),
      });
      const data = (await res.json().catch(() => null)) as RunResponse | null;
      if (data?.steps) setLogs(data.steps);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? data?.error ?? `Install failed (${res.status})`);
      } else {
        setStep("done");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "precheck") {
    return (
      <div style={box}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: 12 }}>
          {precheckState === "running" ? "Testing database connection…" : null}
          {precheckState === "fail" ? (
            <span style={{ color: "#b91c1c" }}>Database unreachable</span>
          ) : null}
          {precheckState === "ok" ? "Connection successful" : null}
        </h2>
        {precheckState === "fail" ? (
          <>
            <p style={{ color: "#475569", marginBottom: 12 }}>
              The wizard needs valid database credentials in <code>.env.local</code> at the
              project root. Create or edit that file and add these lines:
            </p>
            <pre
              style={{
                background: "#0f172a",
                color: "#e2e8f0",
                padding: 12,
                borderRadius: 6,
                overflow: "auto",
                fontSize: "0.85rem",
              }}
            >{`DB_HOST=...
DB_NAME=...
DB_USER=...
DB_PASSWORD=...

# Optional:
# DB_PORT=5432
# DB_SSL=disable    # require | disable`}</pre>
            {precheckMessage ? (
              <div
                style={{
                  marginTop: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: 12,
                  borderRadius: 6,
                  fontSize: "0.85rem",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                }}
              >
                {precheckMessage}
              </div>
            ) : null}
            <p style={{ color: "#475569", marginTop: 12, fontSize: "0.85rem" }}>
              <strong>Note:</strong> restart the Next.js dev server every time you edit
              <code> .env.local</code>.
            </p>
            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" style={btn} onClick={retryPrecheck}>
                Try again
              </button>
            </div>
          </>
        ) : null}
        {precheckState === "running" ? (
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            This can take up to 10 seconds.
          </p>
        ) : null}
      </div>
    );
  }

  if (step === "site") {
    return (
      <div style={box}>
        <Stepper current={1} />
        <h2 style={{ fontSize: "1.2rem", marginBottom: 18 }}>Site information</h2>
        <Field label="Site name *">
          <input
            type="text"
            style={input}
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="e.g. Envoraicms"
          />
        </Field>
        <Field label="Site URL *" hint="must start with https://">
          <input
            type="text"
            style={input}
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://envoraicms.com"
          />
        </Field>
        <Field label="Short description" hint="used as the default meta description">
          <textarea
            style={{ ...input, minHeight: 80, fontFamily: "inherit" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description of your site"
          />
        </Field>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            style={{ ...btn, opacity: canGoSite ? 1 : 0.5 }}
            disabled={!canGoSite}
            onClick={() => setStep("admin")}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  if (step === "admin") {
    return (
      <div style={box}>
        <Stepper current={2} />
        <h2 style={{ fontSize: "1.2rem", marginBottom: 18 }}>Admin account</h2>
        <Field label="Email *">
          <input
            type="email"
            style={input}
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@example.com"
            autoComplete="off"
          />
        </Field>
        <Field label="Full name *">
          <input
            type="text"
            style={input}
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="Jane Doe"
            autoComplete="off"
          />
        </Field>
        <Field label="Password *" hint="at least 8 characters">
          <input
            type="password"
            style={input}
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Password (confirm) *">
          <input
            type="password"
            style={input}
            value={adminPassword2}
            onChange={(e) => setAdminPassword2(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {adminPassword && adminPassword2 && adminPassword !== adminPassword2 ? (
          <div style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: 4 }}>
            Passwords do not match.
          </div>
        ) : null}
        <div
          style={{ marginTop: 18, display: "flex", justifyContent: "space-between" }}
        >
          <button type="button" style={btnSecondary} onClick={() => setStep("site")}>
            ← Back
          </button>
          <button
            type="button"
            style={{ ...btn, opacity: canGoAdmin && !submitting ? 1 : 0.5 }}
            disabled={!canGoAdmin || submitting}
            onClick={runInstall}
          >
            {submitting ? "Installing…" : "Run install"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "run") {
    return (
      <div style={box}>
        <Stepper current={3} />
        <h2 style={{ fontSize: "1.2rem", marginBottom: 18 }}>
          {submitting ? "Installing…" : error ? "Install failed" : "Done"}
        </h2>
        <ol
          style={{
            paddingLeft: 20,
            lineHeight: 1.8,
            fontSize: "0.9rem",
            color: "#334155",
          }}
        >
          {logs.map((s, i) => (
            <li key={i} style={{ color: s.ok ? "#16a34a" : "#b91c1c" }}>
              {s.ok ? "✓" : "✗"} {s.name}
              {s.message ? (
                <span style={{ color: "#64748b", marginLeft: 6 }}>— {s.message}</span>
              ) : null}
            </li>
          ))}
        </ol>
        {error ? (
          <div
            style={{
              marginTop: 18,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: 12,
              borderRadius: 6,
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        ) : null}
        {error ? (
          <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
            <button type="button" style={btnSecondary} onClick={() => setStep("admin")}>
              ← Go back
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={box}>
      <Stepper current={3} done />
      <h2 style={{ fontSize: "1.4rem", marginBottom: 12, color: "#16a34a" }}>
        ✓ Installation complete
      </h2>
      <p style={{ color: "#475569", marginBottom: 16 }}>
        The database is ready, base settings are saved, and your admin account is created.
        You can now sign in at <code>/admin/login</code>.
      </p>
      <ol
        style={{
          paddingLeft: 20,
          lineHeight: 1.7,
          fontSize: "0.88rem",
          color: "#334155",
          marginBottom: 16,
        }}
      >
        {logs.map((s, i) => (
          <li key={i} style={{ color: "#16a34a" }}>
            ✓ {s.name}
          </li>
        ))}
      </ol>
      <div
        style={{
          background: "#fef3c7",
          border: "1px solid #fcd34d",
          color: "#854d0e",
          padding: 12,
          borderRadius: 6,
          marginBottom: 16,
          fontSize: "0.88rem",
        }}
      >
        <strong>Security note:</strong> the installer is now disabled. Visitors to this
        URL are redirected to the home page.
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <a href="/" style={btnSecondary}>
          Home
        </a>
        <a href="/admin/login" style={btn}>
          Go to admin panel →
        </a>
      </div>
    </div>
  );
}

function Field({
  label: l,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={label}>{l}</label>
      {children}
      {hint ? (
        <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: 4 }}>{hint}</div>
      ) : null}
    </div>
  );
}

function Stepper({ current, done }: { current: number; done?: boolean }) {
  const steps = ["Site", "Admin", "Install"];
  return (
    <div
      style={{ display: "flex", gap: 8, marginBottom: 22, fontSize: "0.85rem" }}
      aria-label="Installation steps"
    >
      {steps.map((s, i) => {
        const idx = i + 1;
        const isDone = done || idx < current;
        const isActive = !done && idx === current;
        return (
          <div
            key={s}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 6,
              background: isActive ? "#0ea5e9" : isDone ? "#16a34a" : "#e2e8f0",
              color: isActive || isDone ? "#fff" : "#64748b",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {idx}. {s}
          </div>
        );
      })}
    </div>
  );
}
