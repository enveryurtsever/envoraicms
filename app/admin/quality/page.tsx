import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getSettings } from "@/lib/queries/settings";
import { scanArchive, type ArchiveRow } from "@/lib/queries/archive";
import { ConfirmActionButton } from "./ConfirmActionButton";
import { QualitySettingsForm, RedirectForm, ScanButton } from "./QualityControls";
import { redirectAllDuplicatesAction, removeArticleAction } from "./actions";

export const metadata = { title: "Content Quality" };

const FLAG_LABELS: Record<ArchiveRow["flags"][number], string> = {
  health: "Health",
  election: "Election",
  named_source: "Named source",
  duplicate_url: "Duplicate URL",
  statistics: "Statistics",
};

export default async function QualityPage({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string }>;
}) {
  await requireRole(["admin"]);
  const [settings, sp] = await Promise.all([getSettings(), searchParams]);
  const scan = sp.scan ? await scanArchive() : null;
  const duplicates = scan?.rows.filter((row) => row.originalPath).length ?? 0;

  return (
    <>
      <div className="admin-header">
        <h2>Content Quality</h2>
      </div>

      <QualitySettingsForm>
        <h3>Automatic publishing checks</h3>
        <div className="form-row">
          <label htmlFor="ReviewGateEnabled">Verification</label>
          <div>
            <label style={{ fontWeight: 400, padding: 0, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                id="ReviewGateEnabled"
                name="ReviewGateEnabled"
                type="checkbox"
                defaultChecked={settings.ReviewGateEnabled}
                className="switch"
              />
              Check every automated article against its sources before publishing
            </label>
            <small>
              Articles that fail get one automatic correction. If they still fail, they are
              dropped and the reason appears in the automation logs.
            </small>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="DuplicateWindowDays">Duplicate window (days)</label>
          <div>
            <input
              id="DuplicateWindowDays"
              name="DuplicateWindowDays"
              type="number"
              min={1}
              max={365}
              defaultValue={settings.DuplicateWindowDays}
            />
            <small>A new article repeating one from this period is not published.</small>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="PublisherName">Publisher name</label>
          <div>
            <input
              id="PublisherName"
              name="PublisherName"
              type="text"
              defaultValue={settings.PublisherName ?? ""}
            />
            <small>The business or person responsible for the site. Used on generated legal and contact pages.</small>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="ContactEmail">Contact email</label>
          <div>
            <input
              id="ContactEmail"
              name="ContactEmail"
              type="email"
              defaultValue={settings.ContactEmail ?? ""}
            />
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="EuConsentEnabled">EU consent message</label>
          <div>
            <label style={{ fontWeight: 400, padding: 0, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                id="EuConsentEnabled"
                name="EuConsentEnabled"
                type="checkbox"
                defaultChecked={settings.EuConsentEnabled}
                className="switch"
              />
              A consent message is live for visitors from Europe
            </label>
            <small>
              Turn on after enabling the European message in AdSense under Privacy &amp; messaging,
              or after installing another Google-certified consent platform. The generated Privacy
              page describes it only when this is on.
            </small>
          </div>
        </div>
      </QualitySettingsForm>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Archive cleanup</h3>
        <p>
          Lists published articles that may contain unverified quotes, statistics or duplicate
          URLs, starting with health, election and named-source articles. Nothing changes until
          you choose an action.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <ScanButton hasResults={Boolean(scan)} />
          {duplicates > 0 ? (
            <ConfirmActionButton
              action={redirectAllDuplicatesAction}
              label="Redirect all duplicate URLs"
              confirmLabel="Redirect all"
              title="Redirect all duplicate URLs?"
              description="Every article with a -2 or -3 style URL whose original is live will be unpublished and redirected to the original with a 301."
              successMessage="Duplicate URLs redirected"
            />
          ) : null}
        </div>
      </div>

      {scan ? (
        <div id="archive-results" className="card" style={{ padding: 0, overflow: "hidden", marginTop: "1rem", scrollMarginTop: "1rem" }}>
          <p style={{ padding: "0.75rem 1rem", margin: 0 }}>
            Scanned the newest {scan.scanned.toLocaleString()} articles. Showing {scan.rows.length} to review.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Article</th>
                <th style={{ width: 170 }}>Why it's listed</th>
                <th style={{ width: 380 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {scan.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/contents/${row.id}/edit`} style={{ fontWeight: 500, color: "inherit" }}>
                      {row.title}
                    </Link>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      <a href={row.path} target="_blank" rel="noopener noreferrer">
                        <code>{row.path}</code>
                      </a>
                    </div>
                  </td>
                  <td style={{ fontSize: "0.75rem" }}>
                    {row.flags.map((flag) => FLAG_LABELS[flag]).join(", ")}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <RedirectForm id={row.id} title={row.title} defaultTarget={row.originalPath} />
                      <ConfirmActionButton
                        action={removeArticleAction}
                        id={row.id}
                        label="410"
                        confirmLabel="Remove"
                        title={`Remove "${row.title}"?`}
                        description="The article will be unpublished, its URL will return 410 Gone, and links to it from other articles will be removed."
                        successMessage="Article removed"
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {scan.rows.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", padding: "2rem" }}>
                    Nothing matched.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
