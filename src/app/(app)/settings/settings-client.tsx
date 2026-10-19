"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users, SlidersHorizontal, Save, LoaderCircle, Plus, Pencil, X,
  ShieldCheck, FileWarning, Database, HardDrive,
} from "lucide-react";
import { Card, CardHeader, Field, inputCls, StatusBadge, Th, Td } from "@/components/ui";
import { saveSystemLimits, saveUser } from "@/app/actions/settings";
import { formatDateTime } from "@/lib/utils";

interface UserRow {
  id: string;
  username: string;
  fullName: string;
  role: string;
  active: boolean;
  createdAt: string;
}

const ROLE_DESC: Record<string, string> = {
  ADMIN: "Full control: SMTP, templates, partners, schedules, users and sending.",
  OPS: "Upload logs, process reports, review errors and send within permissions.",
  VIEWER: "Read-only review of reports and delivery history.",
};

export default function SettingsClient({
  users,
  limits,
  currentUserId,
}: {
  users: UserRow[];
  limits: { uploadMaxMb: number; attachmentMaxKb: number; retentionDays: number };
  currentUserId: string;
}) {
  const router = useRouter();
  const [, refresh] = useTransition();

  const [limitsForm, setLimitsForm] = useState(limits);
  const [savingLimits, setSavingLimits] = useState(false);

  const [userDialog, setUserDialog] = useState<UserRow | "new" | null>(null);
  const [userForm, setUserForm] = useState({ username: "", fullName: "", role: "OPS", password: "", active: true });
  const [savingUser, setSavingUser] = useState(false);

  async function saveLimits() {
    setSavingLimits(true);
    await saveSystemLimits(limitsForm);
    setSavingLimits(false);
    toast.success("Processing limits saved.");
    refresh(() => router.refresh());
  }

  function openNewUser() {
    setUserForm({ username: "", fullName: "", role: "OPS", password: "", active: true });
    setUserDialog("new");
  }

  function openEditUser(u: UserRow) {
    setUserForm({ username: u.username, fullName: u.fullName, role: u.role, password: "", active: u.active });
    setUserDialog(u);
  }

  async function saveUserSubmit() {
    setSavingUser(true);
    const res = await saveUser({
      id: userDialog === "new" ? undefined : (userDialog as UserRow).id,
      ...userForm,
    });
    setSavingUser(false);
    if (res.ok) {
      toast.success(userDialog === "new" ? "User created." : "User updated.");
      setUserDialog(null);
      refresh(() => router.refresh());
    } else toast.error(res.error ?? "Could not save the user.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {/* Users & roles */}
      <Card className="anim-fade-up">
        <CardHeader
          title="Users & roles"
          subtitle="Role-based access control for the console"
          action={
            <button onClick={openNewUser}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 px-3 py-1.5 text-[11.5px] font-bold text-navy-950 transition hover:brightness-105">
              <Plus className="h-3.5 w-3.5" /> Add user
            </button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr><Th>User</Th><Th>Role</Th><Th>Status</Th><Th className="text-right">Edit</Th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="transition hover:bg-slate-50/60">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-[11px] font-bold text-gold-400">
                        {(u.fullName || u.username).slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-navy-900">{u.fullName || u.username} {u.id === currentUserId && <span className="text-[10px] text-gold-600">(you)</span>}</p>
                        <p className="font-mono text-[10.5px] text-slate-400">@{u.username}</p>
                      </div>
                    </div>
                  </Td>
                  <Td><StatusBadge status={u.role} /></Td>
                  <Td>{u.active ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />}</Td>
                  <Td className="text-right">
                    <button onClick={() => openEditUser(u)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-navy-900">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 border-t border-slate-100 px-5 py-4">
          {Object.entries(ROLE_DESC).map(([role, desc]) => (
            <div key={role} className="flex items-start gap-2 text-[11.5px] leading-snug text-slate-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
              <span><b className="text-navy-900">{role}</b> — {desc}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-5">
        {/* Processing limits */}
        <Card className="anim-fade-up">
          <CardHeader title="Processing limits" subtitle="Guardrails for uploads and outbound attachments" action={<SlidersHorizontal className="h-4 w-4 text-slate-300" />} />
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Upload max (MB)">
                <input type="number" min={1} max={200} value={limitsForm.uploadMaxMb}
                  onChange={(e) => setLimitsForm({ ...limitsForm, uploadMaxMb: Number(e.target.value) })} className={inputCls("font-mono")} />
              </Field>
              <Field label="Attachment max (KB)">
                <input type="number" min={100} max={51200} value={limitsForm.attachmentMaxKb}
                  onChange={(e) => setLimitsForm({ ...limitsForm, attachmentMaxKb: Number(e.target.value) })} className={inputCls("font-mono")} />
              </Field>
              <Field label="Retention (days)">
                <input type="number" min={30} value={limitsForm.retentionDays}
                  onChange={(e) => setLimitsForm({ ...limitsForm, retentionDays: Number(e.target.value) })} className={inputCls("font-mono")} />
              </Field>
            </div>
            <button onClick={saveLimits} disabled={savingLimits}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-navy-800 disabled:opacity-40">
              {savingLimits ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-gold-400" />}
              Save limits
            </button>
          </div>
        </Card>

        {/* Storage & integrity */}
        <Card className="anim-fade-up p-6">
          <div className="flex items-center gap-2.5">
            <HardDrive className="h-4 w-4 text-navy-600" />
            <h3 className="text-[13px] font-bold text-navy-900">Storage & integrity model</h3>
          </div>
          <ul className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-slate-600">
            <li className="flex items-start gap-2">
              <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
              PostgreSQL stores rows, metadata, recipient/subject snapshots and provider responses; original files and workbooks live in private server storage.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
              Downloads require an authenticated session — no permanent public file URLs are ever issued.
            </li>
            <li className="flex items-start gap-2">
              <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
              Outgoing cells are sanitized against spreadsheet formula injection; SERVICE ID and PRODUCT ID are preserved as text.
            </li>
          </ul>
        </Card>
      </div>

      {/* User dialog */}
      {userDialog && (
        <div className="dialog-backdrop fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 pt-[10vh] anim-fade-in" onClick={() => setUserDialog(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="flex items-center gap-2 font-display text-[15px] font-bold text-navy-900">
                <Users className="h-4 w-4 text-gold-600" /> {userDialog === "new" ? "Add console user" : "Edit user"}
              </h3>
              <button onClick={() => setUserDialog(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-navy-900">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Username">
                  <input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} className={inputCls("font-mono")} placeholder="ops.jane" />
                </Field>
                <Field label="Full name">
                  <input value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} className={inputCls()} placeholder="Jane Doe" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Role">
                  <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className={inputCls()}>
                    <option value="ADMIN">Administrator</option>
                    <option value="OPS">Operations</option>
                    <option value="VIEWER">Read-only reviewer</option>
                  </select>
                </Field>
                <Field label={userDialog === "new" ? "Password (min 8 chars)" : "New password (optional)"}>
                  <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className={inputCls("font-mono")} placeholder="••••••••" autoComplete="new-password" />
                </Field>
              </div>
              <label className="flex items-center gap-2.5 text-[13px] font-semibold text-navy-900">
                <input type="checkbox" checked={userForm.active} onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })} className="h-4 w-4 rounded accent-[#c9a227]" />
                Account active
              </label>
              <button onClick={saveUserSubmit} disabled={savingUser || !userForm.username.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-navy-800 disabled:opacity-40">
                {savingUser && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {userDialog === "new" ? "Create user" : "Save changes"}
              </button>
              {userDialog !== "new" && (
                <p className="text-center text-[10.5px] text-slate-400">Member since {formatDateTime((userDialog as UserRow).createdAt)}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
