"use client";

// A toggle/switch styled checkbox. Keeps form semantics — submits as a normal
// form field. Pass name + defaultChecked, optionally an inline label.

export function Switch({
  name,
  defaultChecked,
  label,
  disabled,
}: {
  name: string;
  defaultChecked?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.55rem",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 400,
        padding: 0,
        userSelect: "none",
      }}
    >
      <input
        type="checkbox"
        role="switch"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="switch"
      />
      {label ? <span>{label}</span> : null}
    </label>
  );
}
