"use client";

import { useState } from "react";

// CSS-only-ish tooltip wrapper. Hover or focus shows a small label below
// the trigger. Wrap any element/button with <Tooltip label="...">.

export function Tooltip({
  label,
  side = "top",
  children,
}: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="adm-tip"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible ? (
        <span className={`adm-tip__bubble adm-tip__bubble--${side}`} role="tooltip">
          {label}
        </span>
      ) : null}
    </span>
  );
}
