import { useSearch } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type LeaveStatus,
  TODAY,
  canCancelLeave,
  formatDate,
  formatRange,
  formatShortTime,
  leaveSubmittedLate,
  leaveTypes,
  validateLeave,
  workingDays,
} from "@/lib/mock-rules";
import { type PageSearch } from "@/lib/search";
import {
  type Leave,
  ME,
  shortName,
  useMock,
  typeShort,
} from "@/components/internspace/shared/model";
import {
  Attachment,
  Confirm,
  DetailList,
  Empty,
  FileField,
  FormError,
  PageHeading,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

// ---------- Intern (design-intern.md Alur 11) ----------
export function InternLeave() {
  const m = useMock();
  const search = useSearch({ strict: false }) as PageSearch;
  const mine = m.leaves
    .filter((l) => l.intern === ME.Intern)
    .sort((a, b) => b.submitted.localeCompare(a.submitted));
  const [filter, setFilter] = useState<"Semua" | LeaveStatus>("Semua");
  const [form, setForm] = useState(false);
  const [view, setView] = useState<Leave | null>(null);
  const [cancel, setCancel] = useState<Leave | null>(null);
  useEffect(() => {
    const l = m.leaves.find((x) => String(x.id) === search.open);
    if (l) setView(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.open]);
  const list = mine.filter((l) => filter === "Semua" || l.status === filter);
  return (
    <>
      <PageHeading
        title="Izin"
        subtitle="Hanya Izin Sakit dan Izin Urgent. Intern tidak memiliki cuti."
        action={
          <Button onClick={() => setForm(true)}>
            <Plus />
            Ajukan Izin
          </Button>
        }
      />
      <Panel
        title="Riwayat izin"
        action={
          <select
            className="role-select"
            aria-label="Filter status"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="Semua">Status: Semua</option>
            {(["Pending", "Disetujui", "Ditolak", "Dibatalkan"] as const).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        }
      >
        {list.length === 0 ? (
          <Empty>Belum ada pengajuan izin.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Jenis</th>
                  <th>Tanggal</th>
                  <th>Hari kerja</th>
                  <th>Status</th>
                  <th>Diproses oleh</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => (
                  <tr key={l.id}>
                    <td>{typeShort(l.type)}</td>
                    <td>{formatRange(l.start, l.end)}</td>
                    <td>{workingDays(l.start, l.end, m.holidayDates)}</td>
                    <td>
                      <Status status={l.status} />
                    </td>
                    <td>{l.by ? `${l.by}${l.byRole === "Admin" ? " (admin)" : ""}` : "-"}</td>
                    <td className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setView(l)}>
                        Lihat
                      </Button>
                      {canCancelLeave(l.status) && (
                        <Button size="sm" variant="outline" onClick={() => setCancel(l)}>
                          Batalkan
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <LeaveForm open={form} onClose={() => setForm(false)} />
      <LeaveDetail leave={view} onClose={() => setView(null)} />
      <Confirm
        open={!!cancel}
        title="Batalkan pengajuan izin?"
        confirmLabel="Ya, batalkan"
        cancelLabel="Kembali"
        destructive
        onClose={() => setCancel(null)}
        onConfirm={() => {
          if (!cancel) return;
          const current = m.leaves.find((l) => l.id === cancel.id);
          if (current && current.status !== "Pending") {
            toast.error(`Izin ini sudah diproses oleh ${current.by ?? "pihak lain"}.`);
          } else {
            m.setLeaves((old) =>
              old.map((l) => (l.id === cancel.id ? { ...l, status: "Dibatalkan" } : l)),
            );
            m.notify(
              "Mentor",
              `${shortName(ME.Intern)} membatalkan pengajuan izin ${formatRange(cancel.start, cancel.end)}.`,
              "/izin",
            );
            toast.success("Pengajuan izin dibatalkan.");
          }
          setCancel(null);
        }}
      >
        {cancel &&
          `${cancel.type} ${formatRange(cancel.start, cancel.end)} akan dibatalkan dan tidak diproses lagi.`}
      </Confirm>
    </>
  );
}

function LeaveForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = useMock();
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setType("");
      setStart("");
      setEnd("");
      setReason("");
      setFile("");
      setError(null);
    }
  }, [open]);
  const days = start && end && end >= start ? workingDays(start, end, m.holidayDates) : 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Ajukan Izin</DialogTitle>
        <DialogDescription>
          Pengajuan dikirim ke mentor. Izin tidak dapat diubah setelah dikirim.
        </DialogDescription>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const err = validateLeave(
              { type, start, end, reason },
              {
                periodStart: m.me.start ?? TODAY,
                periodEnd: m.me.end,
                holidays: m.holidayDates,
                existing: m.leaves.filter((l) => l.intern === ME.Intern),
              },
            );
            setError(err);
            if (err) return;
            const id = Date.now();
            m.setLeaves((old) => [
              ...old,
              {
                id,
                intern: ME.Intern,
                type: type as Leave["type"],
                start,
                end,
                reason: reason.trim(),
                evidence: file,
                status: "Pending",
                submitted: m.nowIso(),
              },
            ]);
            m.notify(
              "Mentor",
              `${shortName(ME.Intern)} mengajukan ${type} ${formatRange(start, end)}.`,
              "/izin",
              { open: String(id) },
            );
            toast.success("Izin diajukan. Menunggu mentor.");
            onClose();
          }}
        >
          <fieldset className="form-field">
            <legend className="mb-2">Jenis izin *</legend>
            <div className="radio-list">
              {leaveTypes.map((t) => (
                <label key={t} className="radio-item">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-two">
            <label className="form-field">
              Tanggal mulai *
              <input
                type="date"
                value={start}
                min={m.me.start}
                max={m.me.end}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="form-field">
              Tanggal selesai *
              <input
                type="date"
                value={end}
                min={start || m.me.start}
                max={m.me.end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Total: <strong>{days} hari kerja</strong> (Sabtu, Minggu, dan libur tidak dihitung)
            {start && start < TODAY && " · Diajukan setelah tanggal izin"}
          </p>
          <label className="form-field">
            Alasan *
            <textarea
              className="!min-h-20"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <FileField label="Lampiran bukti (misalnya surat dokter)" onFile={setFile} />
          <p className="banner muted">
            Tanpa lampiran, izin hanya dapat diproses mentor. Admin hanya membantu bila ada surat
            resmi atau bukti.
          </p>
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">Kirim</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeaveDetail({ leave, onClose }: { leave: Leave | null; onClose: () => void }) {
  const m = useMock();
  return (
    <Dialog open={!!leave} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>
          {leave?.type} · {leave && formatRange(leave.start, leave.end)}
        </DialogTitle>
        <DialogDescription>Status dan catatan pemroses.</DialogDescription>
        {leave && (
          <DetailList
            items={[
              ["Status", <Status key="s" status={leave.status} />],
              [
                "Tanggal",
                `${formatDate(leave.start)} - ${formatDate(leave.end)} (${workingDays(leave.start, leave.end, m.holidayDates)} hari kerja)`,
              ],
              ["Alasan", leave.reason],
              [
                "Lampiran",
                leave.evidence ? <Attachment key="a" name={leave.evidence} /> : "Tanpa bukti",
              ],
              [
                "Diajukan",
                `${formatShortTime(leave.submitted)}${leaveSubmittedLate(leave.start, leave.submitted) ? " · Diajukan setelah tanggal izin" : ""}`,
              ],
              [
                "Diproses oleh",
                leave.by ? `${leave.by} (${leave.byRole === "Admin" ? "admin" : "mentor"})` : "-",
              ],
              ["Catatan", leave.note ?? "-"],
            ]}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
