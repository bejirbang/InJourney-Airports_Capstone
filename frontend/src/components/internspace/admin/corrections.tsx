import { useNavigate, useSearch } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
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
  canDecideCorrection,
  formatDateTime,
  formatShort,
  formatShortTime,
  timeAfter,
} from "@/lib/mock-rules";
import { type PageSearch } from "@/lib/search";
import { type Correction, ME, shortName, useMock } from "@/components/internspace/shared/model";
import {
  DetailList,
  Empty,
  FormError,
  PageHeading,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

// ---------- Koreksi (design-admin.md Alur 4) ----------
export function CorrectionsPage() {
  const m = useMock();
  const search = useSearch({ strict: false }) as PageSearch;
  const [status, setStatus] = useState("Pending");
  const [intern, setIntern] = useState("Semua");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  useEffect(() => {
    if (search.open) setOpenId(Number(search.open));
  }, [search.open]);
  const names = [...new Set(m.corrections.map((c) => c.intern))];
  const list = m.corrections
    .filter((c) => status === "Semua" || c.status === status)
    .filter((c) => intern === "Semua" || c.intern === intern)
    .filter((c) => (!from || c.date >= from) && (!to || c.date <= to))
    .sort((a, b) =>
      status === "Pending"
        ? a.submitted.localeCompare(b.submitted)
        : b.submitted.localeCompare(a.submitted),
    );
  return (
    <>
      <PageHeading
        title="Koreksi Absensi"
        subtitle="Tanyakan dan verifikasi dulu sebelum menyetujui. Admin hanya mengubah jam, status dihitung ulang sistem."
      />
      <div className="toolbar">
        <div className="flex flex-wrap gap-2">
          <select
            className="role-select"
            aria-label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["Pending", "Disetujui", "Ditolak", "Dibatalkan", "Semua"].map((s) => (
              <option key={s} value={s}>
                Status: {s}
              </option>
            ))}
          </select>
          <select
            className="role-select"
            aria-label="Filter intern"
            value={intern}
            onChange={(e) => setIntern(e.target.value)}
          >
            <option value="Semua">Intern: Semua</option>
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
        <span className="flex items-center gap-1 text-[11px]">
          Tanggal
          <input
            className="role-select"
            type="date"
            aria-label="Dari tanggal"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          s/d
          <input
            className="role-select"
            type="date"
            aria-label="Sampai tanggal"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </span>
      </div>
      <Panel title="Permintaan koreksi">
        {list.length === 0 ? (
          <Empty>Belum ada permintaan koreksi.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intern</th>
                  <th>Tanggal absensi</th>
                  <th>Diajukan pada</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>{shortName(c.intern)}</td>
                    <td>{formatShort(c.date, true)}</td>
                    <td>{formatShortTime(c.submitted)}</td>
                    <td>
                      <Status status={c.status} />
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant={c.status === "Pending" ? "outline" : "ghost"}
                        onClick={() => setOpenId(c.id)}
                      >
                        {c.status === "Pending" ? "Buka" : "Lihat"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <CorrectionDecision
        correction={m.corrections.find((c) => c.id === openId) ?? null}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

function CorrectionDecision({
  correction: c,
  onClose,
}: {
  correction: Correction | null;
  onClose: () => void;
}) {
  const m = useMock();
  const navigate = useNavigate();
  const [finalIn, setFinalIn] = useState("");
  const [finalOut, setFinalOut] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    setFinalIn(c?.reqIn ?? "");
    setFinalOut(c?.reqOut ?? "");
    setNote("");
  }, [c?.id, c?.reqIn, c?.reqOut]);
  if (!c) return <Dialog open={false} />;
  const pending = c.status === "Pending";
  const rec = m.rowsFor(c.intern, c.date, c.date)[0];
  const approveOk = canDecideCorrection(c.status, note, finalIn, finalOut);
  const rejectOk = pending && note.trim().length > 0;
  const decide = (approve: boolean) => {
    if (approve) {
      m.setAtt((old) => {
        const exists = old.some((r) => r.intern === c.intern && r.date === c.date);
        return exists
          ? old.map((r) =>
              r.intern === c.intern && r.date === c.date
                ? { ...r, clockIn: finalIn, clockOut: finalOut, corrected: true }
                : r,
            )
          : [
              ...old,
              {
                intern: c.intern,
                date: c.date,
                clockIn: finalIn,
                clockOut: finalOut,
                corrected: true,
              },
            ];
      });
    }
    m.setCorrections((old) =>
      old.map((x) =>
        x.id === c.id
          ? {
              ...x,
              status: approve ? "Disetujui" : "Ditolak",
              by: ME.Admin,
              note: note.trim(),
              ...(approve ? { finalIn, finalOut } : {}),
            }
          : x,
      ),
    );
    if (c.intern === ME.Intern)
      m.notify(
        "Intern",
        `Koreksi absensi ${formatShort(c.date)} ${approve ? "disetujui" : "ditolak"}.`,
        "/absensi",
        { tab: "koreksi" },
      );
    m.log(
      "Absensi",
      c.intern,
      `${approve ? "Setujui" : "Tolak"} koreksi ${formatShort(c.date)}${approve ? `: ${finalIn} - ${finalOut}` : ""}.`,
    );
    toast.success(
      approve
        ? "Koreksi disetujui. Status absensi dihitung ulang."
        : "Koreksi ditolak. Data absensi tidak berubah.",
    );
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <div className="flex justify-between items-start pr-6 gap-3">
          <DialogTitle>
            Koreksi - {c.intern}, {formatShort(c.date, true)}
          </DialogTitle>
          <Status status={c.status} />
        </div>
        <DialogDescription>Diajukan {formatDateTime(c.submitted)}</DialogDescription>
        <div className="compare">
          <div>
            <h4>Data tercatat</h4>
            <p>Clock in: {c.recIn || "-"}</p>
            <p>Clock out: {c.recOut || "-"}</p>
            <p>Status: {rec ? <Status status={rec.status} /> : "-"}</p>
          </div>
          <div>
            <h4>Data diajukan intern</h4>
            <p>Clock in: {c.reqIn || "-"}</p>
            <p>Clock out: {c.reqOut || "-"}</p>
          </div>
        </div>
        <DetailList
          items={[
            ["Alasan intern", `"${c.reason}"`],
            ["Bukti", c.evidence || "-"],
          ]}
        />
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => {
            m.setChatDraft({
              to: c.intern,
              text: `Halo ${c.intern.split(" ")[0]}, terkait koreksi absensi ${formatShort(c.date, true)}: `,
            });
            void navigate({ to: "/chat", search: { to: c.intern } });
          }}
        >
          <MessageSquare />
          Tanya intern lewat chat
        </Button>
        {pending ? (
          <div className="form-grid">
            <h4 className="font-semibold text-xs">Keputusan admin</h4>
            <div className="form-two">
              <label className="form-field">
                Clock in final
                <input type="time" value={finalIn} onChange={(e) => setFinalIn(e.target.value)} />
              </label>
              <label className="form-field">
                Clock out final
                <input type="time" value={finalOut} onChange={(e) => setFinalOut(e.target.value)} />
              </label>
            </div>
            {finalIn && finalOut && !timeAfter(finalIn, finalOut) && (
              <FormError text="Jam clock out harus setelah jam clock in." />
            )}
            <label className="form-field">
              Catatan verifikasi *
              <textarea
                className="!min-h-16"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {!note.trim() && (
              <p className="text-[11px] text-muted-foreground">Catatan verifikasi wajib diisi.</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Validasi lokasi tidak dijalankan ulang. Baris absensi akan diberi label "Dikoreksi
              admin".
            </p>
            <DialogFooter>
              <Button variant="outline" disabled={!rejectOk} onClick={() => decide(false)}>
                Tolak
              </Button>
              <Button disabled={!approveOk} onClick={() => decide(true)}>
                Setujui
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <DetailList
            items={[
              ["Diproses oleh", c.by ?? "-"],
              ["Jam final", c.finalIn ? `${c.finalIn} - ${c.finalOut}` : "-"],
              ["Catatan", c.note ?? "-"],
            ]}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
