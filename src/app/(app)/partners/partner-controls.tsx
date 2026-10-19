"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, X, LoaderCircle, Network, ToggleLeft, ToggleRight,
  Mail, CircleCheck, CircleAlert,
} from "lucide-react";
import { Field, inputCls } from "@/components/ui";
import { savePartner, deletePartner, togglePartnerField, saveService, deleteService } from "@/app/actions/partners";

/* ------------------------------------------------------ */

export interface PartnerData {
  id: string;
  name: string;
  code: string;
  email: string;
  ccEmails: string;
  active: boolean;
  autoSend: boolean;
  notes: string;
}

export interface ServiceData {
  id: string;
  serviceId: string;
  serviceName: string;
  active: boolean;
  partnerId?: string;
}

function Modal({ open, onClose, title, subtitle, children, wide }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; wide?: boolean;
}) {
  // Render the modal directly under document.body so fixed positioning is not
  // trapped by transformed/animated ancestors elsewhere in the page.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="dialog-backdrop fixed inset-0 z-[9999] flex items-stretch justify-center overflow-hidden p-2 sm:p-3"
      style={{ position: "fixed", inset: 0, zIndex: 9999 }}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-wide={wide ? "true" : "false"}
        className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:rounded-2xl"
        style={{
          height: "100%",
          maxHeight: "calc(100dvh - 1.5rem)",
          width: "100%",
          minHeight: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <h3 className="font-display text-[16px] font-bold text-navy-900">{title}</h3>
            {subtitle && <p className="mt-1 max-w-5xl text-[12px] leading-relaxed text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-navy-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </section>
    </div>,
    document.body
  );
}

/* ---------------- Partner dialog ---------------- */

export function PartnerDialog({ partner, open, onClose }: { partner: PartnerData | null; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<PartnerData>(
    partner ?? { id: "", name: "", code: "", email: "", ccEmails: "", active: true, autoSend: false, notes: "" }
  );

  // Reset when opened for a different partner
  const [lastPartnerId, setLastPartnerId] = useState(partner?.id ?? "new");
  if ((partner?.id ?? "new") !== lastPartnerId) {
    setLastPartnerId(partner?.id ?? "new");
    setForm(partner ?? { id: "", name: "", code: "", email: "", ccEmails: "", active: true, autoSend: false, notes: "" });
  }

  function submit() {
    start(async () => {
      const res = await savePartner({
        id: form.id || undefined,
        name: form.name,
        code: form.code,
        email: form.email,
        ccEmails: form.ccEmails,
        active: form.active,
        autoSend: form.autoSend,
        notes: form.notes,
      });
      if (res.ok) {
        toast.success(form.id ? "Partner updated." : `Partner "${form.name}" registered.`);
        onClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save the partner.");
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={form.id ? "Edit partner" : "Register new partner"}
      subtitle="Partner identity is assigned through the Service ID mapping; the SERVICE PARTNER text in uploaded logs is not used for matching.">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)]">
          <Field label="Official partner name" hint="Must reflect the SERVICE PARTNER values in MTN logs">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls()} placeholder="e.g. GameZone Media Ltd" />
          </Field>
          <Field label="Partner code">
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={inputCls("font-mono uppercase")} placeholder="PARTNER01" />
          </Field>
        </div>
        <Field label="Primary recipient email" hint="Receives every service report for this partner">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls("pl-9 font-mono")} placeholder="settlement@partner.com" type="email" />
          </div>
        </Field>
        <Field label="CC recipients (optional)" hint="Separate multiple addresses with commas">
          <input value={form.ccEmails} onChange={(e) => setForm({ ...form, ccEmails: e.target.value })} className={inputCls("font-mono")} placeholder="finance@partner.com, ops@partner.com" />
        </Field>
        <Field label="Notes (optional)">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls()} placeholder="Internal notes…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Active" hint="Inactive partners are not matched" />
          <Toggle checked={form.autoSend} onChange={(v) => setForm({ ...form, autoSend: v })} label="Auto delivery" hint="Included in scheduled sending" />
        </div>
        <button onClick={submit} disabled={pending || !form.name.trim() || !form.code.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-navy-800 disabled:opacity-50">
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {form.id ? "Save changes" : "Register partner"}
        </button>
      </div>
    </Modal>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex items-start gap-2.5 rounded-xl border border-slate-200 px-3.5 py-3 text-left transition hover:border-slate-300">
      {checked ? <ToggleRight className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" /> : <ToggleLeft className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />}
      <span>
        <span className="block text-[12.5px] font-bold text-navy-900">{label}</span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
    </button>
  );
}

/* ---------------- Services dialog (mapping manager) ---------------- */

export function ServicesDialog({ partnerId, partnerName, services, open, onClose, canEdit }: {
  partnerId: string;
  partnerName: string;
  services: ServiceData[];
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<ServiceData | null>(null);
  const [newServiceId, setNewServiceId] = useState("");
  const [newServiceName, setNewServiceName] = useState("");

  function add() {
    if (!newServiceId.trim() || !newServiceName.trim()) {
      toast.error("Enter both the Service ID and the Service Name.");
      return;
    }
    start(async () => {
      const res = await saveService({ partnerId, serviceId: newServiceId, serviceName: newServiceName.toUpperCase(), active: true });
      if (res.ok) {
        toast.success(`Mapping ${newServiceId.trim()} → ${newServiceName.trim().toUpperCase()} saved for continuous use.`);
        setNewServiceId("");
        setNewServiceName("");
        router.refresh();
      } else toast.error(res.error ?? "Could not save the mapping.");
    });
  }

  function saveEdit() {
    if (!editing) return;
    start(async () => {
      const res = await saveService({ id: editing.id, partnerId, serviceId: editing.serviceId, serviceName: editing.serviceName, active: editing.active });
      if (res.ok) {
        toast.success("Mapping updated.");
        setEditing(null);
        router.refresh();
      } else toast.error(res.error ?? "Could not update the mapping.");
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this service mapping? Rows using it will become unresolved until remapped.")) return;
    start(async () => {
      await deleteService(id);
      toast.success("Mapping deleted.");
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={`Service mappings — ${partnerName}`} wide
      subtitle="Manual SERVICE ID → SERVICE NAME mappings. Saved mappings are reused on every upload and can be updated anytime.">
      <div className="space-y-4">
        {services.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[12.5px] text-slate-500">
            No services mapped yet. Add the partner&apos;s first SERVICE ID below.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 text-left">
                  <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Service ID (MTN)</th>
                  <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Service name</th>
                  <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">State</th>
                  {canEdit && <th className="w-20 px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    {editing?.id === s.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input value={editing.serviceId} onChange={(e) => setEditing({ ...editing, serviceId: e.target.value })} className={inputCls("py-1.5 font-mono text-[12px]")} />
                        </td>
                        <td className="px-4 py-2">
                          <input value={editing.serviceName} onChange={(e) => setEditing({ ...editing, serviceName: e.target.value.toUpperCase() })} className={inputCls("py-1.5 text-[12px] font-semibold uppercase")} />
                        </td>
                        <td className="px-4 py-2">
                          <button onClick={() => setEditing({ ...editing, active: !editing.active })} className="text-[11px] font-bold">
                            {editing.active ? <span className="text-emerald-600">ACTIVE</span> : <span className="text-slate-400">INACTIVE</span>}
                          </button>
                        </td>
                        {canEdit && (
                          <td className="space-x-1 whitespace-nowrap px-4 py-2 text-right">
                            <button onClick={saveEdit} disabled={pending} className="rounded-md bg-navy-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-navy-800">Save</button>
                            <button onClick={() => setEditing(null)} className="rounded-md px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                          </td>
                        )}
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 font-mono text-[12.5px] font-bold text-navy-900">{s.serviceId}</td>
                        <td className="px-4 py-2.5 text-[12.5px] font-semibold uppercase tracking-wide text-slate-700">{s.serviceName}</td>
                        <td className="px-4 py-2.5">
                          {s.active
                            ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><CircleCheck className="h-3.5 w-3.5" /> Active</span>
                            : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400"><CircleAlert className="h-3.5 w-3.5" /> Inactive</span>}
                        </td>
                        {canEdit && (
                          <td className="space-x-1 whitespace-nowrap px-4 py-2.5 text-right">
                            <button onClick={() => setEditing(s)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-navy-900" title="Edit mapping">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => remove(s.id)} disabled={pending} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete mapping">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canEdit && (
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Plus className="h-3.5 w-3.5 text-gold-600" /> Add new mapping
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)_auto] sm:items-end">
              <div className="min-w-0">
                <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Service ID</label>
                <input value={newServiceId} onChange={(e) => setNewServiceId(e.target.value)} placeholder="e.g. 0123456001" className={inputCls("w-full min-w-0 font-mono")} />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Service name</label>
                <input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value.toUpperCase())} placeholder="e.g. GAMEZONE / POKER" className={inputCls("w-full min-w-0 uppercase")} />
              </div>
              <button onClick={add} disabled={pending}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-navy-800 disabled:opacity-50">
                {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              The service name is used in the email subject, filename and report. Map every SERVICE ID that appears in
              this partner&apos;s MTN logs — unmapped IDs are flagged under Unmatched Records.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Row controls ---------------- */

export function AddPartnerButton({ label = "Add partner", icon }: { label?: string; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 px-4 py-2 text-[13px] font-bold text-navy-950 shadow-sm shadow-gold-600/30 transition hover:brightness-105 active:scale-[0.98]">
        {icon ?? <Plus className="h-4 w-4" />} {label}
      </button>
      {open && <PartnerDialog key="new" partner={null} open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PartnerActions({ partner, canEdit }: { partner: PartnerData; canEdit: boolean }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!canEdit) return <span className="text-[11px] text-slate-300">—</span>;

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        title={partner.autoSend ? "Disable automatic delivery" : "Enable automatic delivery"}
        disabled={pending}
        onClick={() => start(async () => {
          await togglePartnerField(partner.id, "autoSend", !partner.autoSend);
          toast.success(`Automatic delivery ${partner.autoSend ? "disabled" : "enabled"} for ${partner.name}.`);
          router.refresh();
        })}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${partner.autoSend ? "text-gold-600 hover:bg-gold-500/10" : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"}`}>
        {partner.autoSend ? <ToggleRight className="h-4.5 w-4.5" /> : <ToggleLeft className="h-4.5 w-4.5" />}
      </button>
      <button
        title={partner.active ? "Deactivate partner" : "Activate partner"}
        disabled={pending}
        onClick={() => start(async () => {
          await togglePartnerField(partner.id, "active", !partner.active);
          toast.success(`${partner.name} ${partner.active ? "deactivated" : "activated"}.`);
          router.refresh();
        })}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${partner.active ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-300 hover:bg-slate-100"}`}>
        <CircleCheck className="h-4 w-4" />
      </button>
      <button title="Edit partner" onClick={() => setEditOpen(true)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-navy-900">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button title="Delete partner" disabled={pending}
        onClick={() => {
          if (!confirm(`Delete ${partner.name} and all of its service mappings? Historical reports are kept.`)) return;
          start(async () => {
            await deletePartner(partner.id);
            toast.success("Partner deleted.");
            router.refresh();
          });
        }}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {editOpen && <PartnerDialog key={partner.id} partner={partner} open={editOpen} onClose={() => setEditOpen(false)} />}
    </div>
  );
}

export function ServiceCountLink({ partnerId, partnerName, count, services, canEdit }: {
  partnerId: string; partnerName: string; count: number; services: ServiceData[]; canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-[12px] font-bold text-navy-900 transition hover:border-gold-500/60 hover:bg-gold-500/[0.06]">
        <Network className="h-3.5 w-3.5 text-gold-600" />
        {count} {count === 1 ? "service" : "services"}
      </button>
      {open && (
        <ServicesDialog partnerId={partnerId} partnerName={partnerName} services={services} open={open} onClose={() => setOpen(false)} canEdit={canEdit} />
      )}
    </>
  );
}
