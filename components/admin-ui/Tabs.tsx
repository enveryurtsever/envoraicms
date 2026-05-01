"use client";

import { useState, useEffect } from "react";

export type TabDef = {
  id: string;
  label: string;
  hint?: string;
  content: React.ReactNode;
};

// Client-only tab switcher that keeps the active tab in the URL hash so the
// active tab survives a refresh / a server action's revalidation.
export function Tabs({
  tabs,
  defaultTab,
  storageKey,
}: {
  tabs: TabDef[];
  defaultTab?: string;
  storageKey?: string;
}) {
  // First render must match the server output: always start with the default
  // tab. We restore any persisted/hash selection inside an effect, so the
  // mount-time tree is stable for hydration and the swap happens after.
  const [active, setActive] = useState<string | undefined>(
    defaultTab ?? tabs[0]?.id,
  );

  // Restore from URL hash / localStorage on mount.
  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, "");
    if (fromHash && tabs.some((t) => t.id === fromHash)) {
      setActive(fromHash);
      return;
    }
    if (storageKey) {
      const saved = window.localStorage.getItem(storageKey);
      if (saved && tabs.some((t) => t.id === saved)) setActive(saved);
    }
    // tabs is stable across renders for a given page; only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist + reflect in URL on change. Skipped on the initial mount commit
  // because `active` then equals the server-rendered default and writing the
  // hash here would double-fire with the restore effect above.
  useEffect(() => {
    if (!active) return;
    if (storageKey) window.localStorage.setItem(storageKey, active);
    if (window.location.hash !== `#${active}`) {
      history.replaceState(null, "", `#${active}`);
    }
  }, [active, storageKey]);

  const activeId = tabs.find((t) => t.id === active)?.id ?? tabs[0]?.id;

  return (
    <div className="adm-tabs">
      <nav className="adm-tabs__nav" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeId === t.id}
            className={`adm-tabs__tab ${activeId === t.id ? "active" : ""}`}
            onClick={() => setActive(t.id)}
          >
            <span>{t.label}</span>
            {t.hint ? <span className="adm-tabs__hint">{t.hint}</span> : null}
          </button>
        ))}
      </nav>
      {/* Render every panel so inputs in inactive tabs still submit with the
          surrounding form. We hide non-active panels with the HTML `hidden`
          attribute so the browser keeps them in the DOM but out of view. */}
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          className="adm-tabs__panel"
          hidden={t.id !== activeId}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
