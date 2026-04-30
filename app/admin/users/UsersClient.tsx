"use client";

import { useState } from "react";
import type { User } from "@/lib/types";
import { FormModal } from "@/components/admin-ui/FormModal";
import { RowDeleteButton } from "@/components/admin-ui/RowDeleteButton";
import { LocalDate } from "@/components/admin-ui/LocalDate";
import { UserFields } from "./UserFields";
import { createUserAction, updateUserAction, deleteUserAction } from "./actions";

export function UsersClient({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: number | null;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  return (
    <>
      <div className="admin-header">
        <div>
          <h2>Users</h2>
          <div className="subtitle">Admin and editor accounts.</div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            Add User
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>Email</th>
              <th>Name</th>
              <th style={{ width: 100 }}>Role</th>
              <th style={{ width: 170 }}>Last login</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 180, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.UserID}>
                <td>{u.UserID}</td>
                <td>
                  {u.Email}
                  {currentUserId === u.UserID ? (
                    <span className="badge ok" style={{ marginLeft: 6 }}>you</span>
                  ) : null}
                </td>
                <td>{u.DisplayName ?? u.Username ?? "—"}</td>
                <td><span className="badge off">{u.Role}</span></td>
                <td style={{ fontSize: "0.75rem" }}>
                  <LocalDate value={u.LastLoginAt} mode="relative" />
                </td>
                <td>
                  {u.IsActive ? (
                    <span className="badge ok">active</span>
                  ) : (
                    <span className="badge off">inactive</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setEditing(u)}
                  >
                    Edit
                  </button>{" "}
                  {currentUserId === u.UserID ? null : (
                    <RowDeleteButton
                      action={deleteUserAction}
                      id={u.UserID}
                      confirmTitle={`Delete "${u.Email}"?`}
                      confirmDescription="The user will be deactivated and soft-deleted."
                      successMessage="User deleted"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating ? (
        <FormModal
          open
          onClose={() => setCreating(false)}
          title="Add User"
          size="md"
          submitLabel="Create user"
          successMessage="User created"
          action={createUserAction}
        >
          <UserFields isCreate />
        </FormModal>
      ) : null}

      {editing ? (
        <FormModal
          open
          onClose={() => setEditing(null)}
          title={`Edit "${editing.Email}"`}
          size="md"
          submitLabel="Save changes"
          successMessage="User updated"
          action={updateUserAction}
        >
          <UserFields isCreate={false} value={editing} />
        </FormModal>
      ) : null}
    </>
  );
}
