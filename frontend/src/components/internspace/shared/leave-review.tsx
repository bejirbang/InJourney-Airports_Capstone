import { useSearch } from "@tanstack/react-router";
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
  canApproveLeave,
  canMentorDecideLeave,
  canRejectLeave,
  formatDate,
  formatRange,
  formatShortTime,
  isOverduePending,
  leaveSubmittedLate,
  leaveTypes,
  pendingHours,
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
  DetailList,
  Empty,
  FormError,
  PageHeading,
  Panel,
  Status,
  Tabs,
  Tag,
} from "@/components/internspace/shared/ui";

// ---------- Mentor dan Admin (design-mentor.md Alur 7, design-admin.md Alur 5) ----------
export function ReviewerLeave() {
  const m = useMock();
  const isAdmin = m.role === "Admin";
  const search = useSearch({ strict: false }) as PageSearch;
  const names = isAdmin
    ? m.people.filter((p) => p.role === "Intern").map((p) => p.name)
    : m.internsOf(ME.Mentor).map((p) => p.name);
  const scope = m.leaves.filter((l) => names.includes(l.intern));
  const [tab, setTab] = useState<"pending" | "semua">("pending");
  const [type, setType] = useState("Semua");
  const [intern, setIntern] = useState("Semua");
  const [openId, setOpenId] = useState<number | null>(null);
  useEffect(() => {
    if (search.open) setOpenId(Number(search.open));
  }, [search.open]);
  const pending = scope.filter((l) => l.status === "Pending");
  const list = (tab === "pending" ? pending : scope)
    .filter((l) => type === "Semua" || l.type === type)
    .filter((l) => intern === "Semua" || l.intern === intern)
    .sort((a, b) =>
      tab === "pending"
        ? a.submitted.localeCompare(b.submitted)
        : b.submitted.localeCompare(a.submitted),
    );
  return (
    <>
      <PageHeading
        title="Izin"
        subtitle={
          isAdmin
            ? "Admin hanya memproses izin yang masih Pending lebih dari 24 jam, dan hanya bila ada surat resmi atau bukti."
            : "Proses izin intern bimbingan. Mentor memproses lebih dulu."
        }
      />
      <div className="toolbar">
        <Tabs
          label="Daftar izin"
          value={tab}
          onChange={setTab}
          items={[
            { value: "pending", label: `Pending (${pending.length})` },
            { value: "semua", label: "Semua" },
          ]}
        />
        <div className="toolbar-filters">
          <select
            className="role-select"
            aria-label="Filter jenis"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="Semua">Jenis: Semua</option>
            {leaveTypes.map((t) => (
              <option key={t}>{t}</option>
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
      </div>
      <Panel
        title={tab === "pending" ? "Menunggu keputusan" : "Semua pengajuan"}
        subtitle={tab === "pending" ? "Diurutkan dari yang paling lama pending." : undefined}
      >
        {list.length === 0 ? (
          <Empty>
            {tab === "pending" ? "Tidak ada izin yang menunggu." : "Belum ada pengajuan izin."}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intern</th>
                  {isAdmin && <th>Mentor</th>}
                  <th>Jenis</th>
                  <th>Tanggal</th>
                  <th>Hari kerja</th>
                  <th>Bukti</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => {
                  const overdue = isOverduePending(l.status, l.submitted);
                  return (
                    <tr key={l.id}>
                      <td>{shortName(l.intern)}</td>
                      {isAdmin && <td>{m.person(l.intern)?.mentor}</td>}
                      <td>{typeShort(l.type)}</td>
                      <td>
                        {formatRange(l.start, l.end)}
                        {leaveSubmittedLate(l.start, l.submitted) && (
                          <div>
                            <Tag tone="light">Diajukan setelah tanggal izin</Tag>
                          </div>
                        )}
                      </td>
                      <td>{workingDays(l.start, l.end, m.holidayDates)}</td>
                      <td>{l.evidence ? "Ada" : "Tidak"}</td>
                      <td>
                        <Status status={l.status} />
                        {l.status === "Pending" && (
                          <div
                            className={`text-[10px] mt-1 ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}
                          >
                            {overdue
                              ? `! pending ${pendingHours(l.submitted)} jam`
                              : `diajukan ${pendingHours(l.submitted)} jam lalu`}
                          </div>
                        )}
                        {l.byRole === "Admin" && !isAdmin && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            Diproses oleh admin
                          </div>
                        )}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant={l.status === "Pending" ? "outline" : "ghost"}
                          onClick={() => setOpenId(l.id)}
                        >
                          {l.status === "Pending" ? "Buka" : "Lihat"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <DecisionDialog
        leave={scope.find((l) => l.id === openId) ?? null}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

function DecisionDialog({ leave, onClose }: { leave: Leave | null; onClose: () => void }) {
  const m = useMock();
  const isAdmin = m.role === "Admin";
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    setNote("");
    setChecked(false);
    setTouched(false);
  }, [leave?.id]);
  if (!leave) return <Dialog open={false} />;
  const pending = leave.status === "Pending";
  const adminCanAct = !isAdmin || isOverduePending(leave.status, leave.submitted);
  const approveOk = isAdmin
    ? canApproveLeave(leave.status, !!leave.evidence, checked, note)
    : canMentorDecideLeave(leave.status, note);
  const rejectOk = isAdmin
    ? canRejectLeave(leave.status, note)
    : canMentorDecideLeave(leave.status, note);
  const decide = (status: "Disetujui" | "Ditolak") => {
    setTouched(true);
    if (!(status === "Disetujui" ? approveOk : rejectOk)) return;
    m.setLeaves((old) =>
      old.map((l) =>
        l.id === leave.id
          ? {
              ...l,
              status,
              by: m.me.name,
              byRole: m.role,
              note: note.trim(),
              decidedAt: m.nowIso(),
            }
          : l,
      ),
    );
    const verb = status === "Disetujui" ? "disetujui" : "ditolak";
    if (leave.intern === ME.Intern)
      m.notify("Intern", `${leave.type} ${formatRange(leave.start, leave.end)} ${verb}.`, "/izin", {
        open: String(leave.id),
      });
    if (isAdmin) {
      m.notify("Mentor", `Izin ${shortName(leave.intern)} diproses oleh admin.`, "/izin", {
        open: String(leave.id),
      });
      m.log(
        "Izin",
        leave.intern,
        `${status === "Disetujui" ? "Setujui" : "Tolak"} izin pending ${formatRange(leave.start, leave.end)}.`,
      );
    }
    toast.success(
      status === "Disetujui"
        ? "Izin disetujui. Status absensi hari terkait menjadi Izin."
        : "Izin ditolak.",
    );
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <div className="flex justify-between items-start pr-6 gap-3">
          <DialogTitle>Izin - {leave.intern}</DialogTitle>
          <Status status={leave.status} />
        </div>
        <DialogDescription>
          {isAdmin && `Mentor: ${m.person(leave.intern)?.mentor} · `}
          {leave.type} · {workingDays(leave.start, leave.end, m.holidayDates)} hari kerja
        </DialogDescription>
        <DetailList
          items={[
            ["Tanggal", `${formatDate(leave.start)} - ${formatDate(leave.end)}`],
            ["Alasan", `"${leave.reason}"`],
            [
              "Lampiran",
              leave.evidence ? (
                <Attachment key="a" name={leave.evidence} />
              ) : (
                <Tag key="t" tone="orange">
                  Tanpa bukti
                </Tag>
              ),
            ],
            [
              "Diajukan",
              `${formatShortTime(leave.submitted)} (${pendingHours(leave.submitted)} jam lalu)${leaveSubmittedLate(leave.start, leave.submitted) ? " · Diajukan setelah tanggal izin" : ""}`,
            ],
            ...(!pending
              ? ([
                  [
                    "Diproses oleh",
                    leave.by
                      ? `${leave.by} (${leave.byRole === "Admin" ? "admin" : "mentor"})`
                      : "-",
                  ],
                  ["Catatan", leave.note ?? "-"],
                ] as [string, string][])
              : []),
          ]}
        />
        {!pending && (
          <p className="text-[11px] text-muted-foreground">
            {leave.status === "Dibatalkan"
              ? "Pengajuan ini sudah dibatalkan intern."
              : "Keputusan sudah dibuat dan tidak dapat diubah."}
          </p>
        )}
        {pending && isAdmin && !adminCanAct && (
          <div className="banner muted">
            Izin ini belum lewat 24 jam. Tunggu mentor memproses lebih dulu.
          </div>
        )}
        {pending && adminCanAct && (
          <div className="form-grid">
            {isAdmin && (
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!leave.evidence}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                <span>Saya sudah memeriksa surat resmi atau bukti</span>
              </label>
            )}
            <label className="form-field">
              Catatan *
              <textarea
                className="!min-h-20"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {touched && !note.trim() && <FormError text="Catatan wajib diisi." />}
            {isAdmin && !leave.evidence && (
              <FormError text="Tidak ada surat resmi atau bukti. Admin hanya dapat menolak atau menunggu mentor." />
            )}
            <DialogFooter>
              <Button variant="outline" disabled={!rejectOk} onClick={() => decide("Ditolak")}>
                Tolak
              </Button>
              <Button
                disabled={!approveOk}
                title={isAdmin && !leave.evidence ? "Tidak ada surat resmi atau bukti." : undefined}
                onClick={() => decide("Disetujui")}
              >
                Setujui
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
