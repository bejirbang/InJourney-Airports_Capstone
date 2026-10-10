import { useEffect, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
  addDays,
  canApproveLeave,
  canCancelLeave,
  canMentorDecideLeave,
  canRejectLeave,
  formatDate,
  formatMonth,
  formatRange,
  formatShort,
  formatShortTime,
  isOverduePending,
  isWorkingDay,
  leaveSubmittedLate,
  leaveTypes,
  monthEnd,
  pendingHours,
  validateLeave,
  weekdayIndex,
  workingDays,
  type LeaveStatus,
} from "@/lib/mock-rules";
import type { PageSearch } from "@/lib/search";
import { ME, shortName, useMock, type Leave } from "./model";
import {
  Attachment,
  Confirm,
  DetailList,
  Empty,
  FormError,
  MonthNav,
  PageHeading,
  Panel,
  Status,
  Tabs,
  Tag,
} from "./shared";

export function LeavePage() {
  const m = useMock();
  return m.role === "Intern" ? <InternLeave /> : <ReviewerLeave />;
}

const typeShort = (t: string) => t.replace("Izin ", "");

// ---------- Intern (design-intern.md Alur 11) ----------

function InternLeave() {
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
            <div className="flex gap-5">
              {leaveTypes.map((t) => (
                <label key={t} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                  />
                  {t}
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
          <label className="form-field">
            Lampiran bukti (misalnya surat dokter)
            <input type="file" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
            <small className="text-muted-foreground">
              Jenis dan batas ukuran file ditetapkan tim backend.
            </small>
          </label>
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

// ---------- Mentor dan Admin (design-mentor.md Alur 7, design-admin.md Alur 5) ----------

function ReviewerLeave() {
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
        <div className="flex gap-2">
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
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!leave.evidence}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                Saya sudah memeriksa surat resmi atau bukti
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

// ---------- Kalender Izin mentor (design-mentor.md Alur 8) ----------

export function LeaveCalendarPage() {
  const m = useMock();
  const interns = m.internsOf(ME.Mentor);
  const names = interns.map((p) => p.name);
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [intern, setIntern] = useState("Semua");
  const [pick, setPick] = useState<Leave | null>(null);
  const [more, setMore] = useState<string | null>(null);
  const visible = m.leaves.filter(
    (l) =>
      names.includes(l.intern) &&
      (l.status === "Pending" || l.status === "Disetujui") &&
      (intern === "Semua" || l.intern === intern),
  );
  const first = `${month}-01`;
  const last = monthEnd(month);
  const cells: (string | null)[] = [...Array<null>(weekdayIndex(first)).fill(null)];
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d);
  const inMonth = visible.filter((l) => l.start <= last && l.end >= first);
  return (
    <>
      <PageHeading
        title="Kalender Izin"
        subtitle="Izin terdeteksi otomatis. Pending bergaris tepi, Disetujui berwarna penuh."
      />
      <div className="toolbar">
        <MonthNav value={month} onChange={setMonth} min="2026-07" max="2027-01" />
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
      <Panel
        title={formatMonth(month)}
        subtitle={
          inMonth.length === 0 ? "Tidak ada izin pada bulan ini." : `${inMonth.length} pengajuan`
        }
      >
        <div className="calendar">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
            <div key={d} className="calendar-head">
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} className="calendar-cell empty" />;
            const off = !isWorkingDay(d, m.holidayDates);
            const entries = off ? [] : visible.filter((l) => l.start <= d && l.end >= d);
            return (
              <div
                key={d}
                className={`calendar-cell ${off ? "off" : ""} ${d === TODAY ? "today" : ""}`}
              >
                <span className="calendar-day">{Number(d.slice(8))}</span>
                {off && <span className="text-[9px]">{m.holidayName(d) ?? "libur"}</span>}
                {entries.slice(0, 3).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`leave-chip ${l.status === "Pending" ? "pending" : "approved"}`}
                    onClick={() => setPick(l)}
                  >
                    {l.intern.split(" ")[0]} ({typeShort(l.type)[0]})
                  </button>
                ))}
                {entries.length > 3 && (
                  <button
                    type="button"
                    className="text-[9px] text-primary"
                    onClick={() => setMore(d)}
                  >
                    +{entries.length - 3} lagi
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="leave-chip approved">Penuh</i> Izin Disetujui
          </span>
          <span>
            <i className="leave-chip pending">Garis tepi</i> Izin Pending
          </span>
          <span>(S) = Sakit · (U) = Urgent</span>
        </div>
      </Panel>
      <Dialog open={!!pick} onOpenChange={(o) => !o && setPick(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{pick?.intern}</DialogTitle>
          <DialogDescription>
            {pick?.type} · {pick && formatRange(pick.start, pick.end)}
          </DialogDescription>
          {pick && <Status status={pick.status} />}
          <DialogFooter>
            <Button asChild>
              <Link to="/izin" search={{ open: String(pick?.id ?? "") }}>
                Buka izin
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!more} onOpenChange={(o) => !o && setMore(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Izin {more && formatShort(more, true)}</DialogTitle>
          <DialogDescription>Semua intern yang izin pada tanggal ini.</DialogDescription>
          {visible
            .filter((l) => more && l.start <= more && l.end >= more)
            .map((l) => (
              <button
                key={l.id}
                type="button"
                className="text-left text-xs"
                onClick={() => setPick(l)}
              >
                {l.intern} · {l.type} · <Status status={l.status} />
              </button>
            ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
