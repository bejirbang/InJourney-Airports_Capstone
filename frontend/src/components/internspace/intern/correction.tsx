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
  TODAY,
  canCancelCorrection,
  formatShort,
  formatShortTime,
  isWorkingDay,
  validateCorrection,
} from "@/lib/mock-rules";
import {
  type AttRec,
  type Correction,
  ME,
  shortName,
  useMock,
} from "@/components/internspace/shared/model";
import {
  Confirm,
  DetailList,
  Empty,
  FileField,
  FormError,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

export function CorrectionTab({
  presetDate,
  onPresetUsed,
}: {
  presetDate: string | null;
  onPresetUsed: () => void;
}) {
  const m = useMock();
  const mine = m.corrections
    .filter((c) => c.intern === ME.Intern)
    .sort((a, b) => b.submitted.localeCompare(a.submitted));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Correction | null>(null);
  const [cancel, setCancel] = useState<Correction | null>(null);
  useEffect(() => {
    if (presetDate) setOpen(true);
  }, [presetDate]);
  return (
    <Panel
      title="Koreksi absensi"
      subtitle="Permintaan diajukan ke admin. Admin memverifikasi dulu, bisa lewat chat."
      action={
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Ajukan Koreksi
        </Button>
      }
    >
      {mine.length === 0 ? (
        <Empty>Belum ada permintaan koreksi.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal absensi</th>
                <th>Diajukan</th>
                <th>Status</th>
                <th>Catatan admin</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((c) => (
                <tr key={c.id}>
                  <td>{formatShort(c.date, true)}</td>
                  <td>{formatShortTime(c.submitted)}</td>
                  <td>
                    <Status status={c.status} />
                  </td>
                  <td className="max-w-56 truncate">{c.note ? `"${c.note}"` : "-"}</td>
                  <td>
                    {canCancelCorrection(c.status) ? (
                      <Button size="sm" variant="outline" onClick={() => setCancel(c)}>
                        Batalkan
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setView(c)}>
                        Lihat
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CorrectionForm
        open={open}
        presetDate={presetDate}
        onClose={() => {
          setOpen(false);
          onPresetUsed();
        }}
      />
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent>
          <DialogTitle>Koreksi {view && formatShort(view.date, true)}</DialogTitle>
          <DialogDescription>
            Keputusan yang sudah diproses tidak bisa dibuka ulang.
          </DialogDescription>
          {view && (
            <DetailList
              items={[
                ["Status", <Status key="s" status={view.status} />],
                [
                  "Data tercatat",
                  `Clock in ${view.recIn || "-"} | Clock out ${view.recOut || "-"}`,
                ],
                ["Diajukan", `Clock in ${view.reqIn || "-"} | Clock out ${view.reqOut || "-"}`],
                ["Alasan", view.reason],
                ["Bukti", view.evidence || "-"],
                ["Diproses oleh", view.by ?? "-"],
                ["Catatan admin", view.note ?? "-"],
              ]}
            />
          )}
        </DialogContent>
      </Dialog>
      <Confirm
        open={!!cancel}
        title="Batalkan permintaan koreksi?"
        confirmLabel="Ya, batalkan"
        cancelLabel="Kembali"
        destructive
        onClose={() => setCancel(null)}
        onConfirm={() => {
          if (!cancel) return;
          m.setCorrections((old) =>
            old.map((c) => (c.id === cancel.id ? { ...c, status: "Dibatalkan" } : c)),
          );
          setCancel(null);
          toast.success("Permintaan koreksi dibatalkan.");
        }}
      >
        Permintaan koreksi tanggal {cancel && formatShort(cancel.date, true)} akan dibatalkan dan
        tidak diproses admin.
      </Confirm>
    </Panel>
  );
}

function CorrectionForm({
  open,
  presetDate,
  onClose,
}: {
  open: boolean;
  presetDate: string | null;
  onClose: () => void;
}) {
  const m = useMock();
  const [date, setDate] = useState("");
  const [inT, setIn] = useState("");
  const [outT, setOut] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorded: AttRec | undefined = m.att.find((r) => r.intern === ME.Intern && r.date === date);
  useEffect(() => {
    if (!open) return;
    const d = presetDate ?? "";
    const rec = m.att.find((r) => r.intern === ME.Intern && r.date === d);
    setDate(d);
    setIn(rec?.clockIn ?? "");
    setOut(rec?.clockOut ?? "");
    setReason("");
    setFile("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetDate]);
  const submit = () => {
    const err = validateCorrection(
      { date, clockIn: inT, clockOut: outT, reason },
      {
        today: TODAY,
        periodStart: m.me.start ?? TODAY,
        periodEnd: m.me.end,
        holidays: m.holidayDates,
        pendingDates: m.corrections
          .filter((c) => c.intern === ME.Intern && c.status === "Pending")
          .map((c) => c.date),
      },
    );
    setError(err);
    if (err) return;
    const id = Date.now();
    m.setCorrections((old) => [
      ...old,
      {
        id,
        intern: ME.Intern,
        date,
        recIn: recorded?.clockIn ?? "",
        recOut: recorded?.clockOut ?? "",
        reqIn: inT,
        reqOut: outT,
        reason: reason.trim(),
        evidence: file,
        status: "Pending",
        submitted: m.nowIso(),
      },
    ]);
    m.notify(
      "Admin",
      `${shortName(ME.Intern)} mengajukan koreksi absensi ${formatShort(date)}.`,
      "/koreksi",
      { open: String(id) },
    );
    toast.success("Permintaan koreksi terkirim. Menunggu admin.");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Ajukan Koreksi Absensi</DialogTitle>
        <DialogDescription>
          Admin dapat menghubungi Anda lewat chat untuk verifikasi.
        </DialogDescription>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="form-field">
            Tanggal absensi *
            <input
              type="date"
              value={date}
              min={m.me.start}
              max={TODAY}
              onChange={(e) => {
                const rec = m.att.find((r) => r.intern === ME.Intern && r.date === e.target.value);
                setDate(e.target.value);
                setIn(rec?.clockIn ?? "");
                setOut(rec?.clockOut ?? "");
              }}
            />
          </label>
          {date && (
            <p className="text-[11px] text-muted-foreground">
              Data tercatat: Clock in {recorded?.clockIn || "-"} | Clock out{" "}
              {recorded?.clockOut || "-"}
              {!isWorkingDay(date, m.holidayDates) && " (hari libur)"}
            </p>
          )}
          <div className="form-two">
            <label className="form-field">
              Clock in yang benar
              <input type="time" value={inT} onChange={(e) => setIn(e.target.value)} />
            </label>
            <label className="form-field">
              Clock out yang benar
              <input type="time" value={outT} onChange={(e) => setOut(e.target.value)} />
            </label>
          </div>
          <label className="form-field">
            Alasan *
            <textarea
              className="!min-h-20"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <FileField label="Bukti (opsional)" onFile={setFile} />
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
