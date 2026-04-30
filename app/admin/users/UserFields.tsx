"use client";

import type { User, UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["admin", "editor", "viewer"];

export function UserFields({
  value,
  isCreate,
}: {
  value?: User;
  isCreate: boolean;
}) {
  const v = value;
  return (
    <>
      {v ? <input type="hidden" name="id" defaultValue={v.UserID} /> : null}

      <Row label="Email *" name="Email" type="email" defaultValue={v?.Email} />
      <Row label="Display name" name="DisplayName" defaultValue={v?.DisplayName} />
      <Row label="Username" name="Username" defaultValue={v?.Username} hint="optional, lowercase, no spaces" />

      <div className="form-row">
        <label htmlFor="Role">Role</label>
        <select id="Role" name="Role" defaultValue={v?.Role ?? "editor"}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {isCreate ? (
        <Row
          label="Password *"
          name="Password"
          type="password"
          autoComplete="new-password"
          hint="at least 8 characters"
        />
      ) : (
        <>
          <Row
            label="New password"
            name="NewPassword"
            type="password"
            autoComplete="new-password"
            hint="leave blank to keep the current password"
          />
          <Row label="Active" name="IsActive" type="checkbox" checked={v?.IsActive ?? true} />
        </>
      )}
    </>
  );
}

function Row({
  label,
  name,
  defaultValue,
  type = "text",
  checked,
  hint,
  autoComplete,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  checked?: boolean;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <div>
        {type === "checkbox" ? (
          <input id={name} name={name} type="checkbox" defaultChecked={checked ?? false} />
        ) : (
          <input
            id={name}
            name={name}
            type={type}
            defaultValue={defaultValue ?? ""}
            autoComplete={autoComplete}
          />
        )}
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}
