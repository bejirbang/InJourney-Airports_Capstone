import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { CalendarDays, LogIn, LogOut, MapPin, Pencil, Plus, Search } from "lucide-react";
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
  clockOutCheck,
  formatDate,
  formatDateLong,
  formatMonth,
  formatShort,
  formatShortTime,
  isWorkingDay,
  validateCorrection,
  validateReport,
} from "@/lib/mock-rules";
import type { PageSearch } from "@/lib/search";
import { ME, recap, shortName, useMock, type AttRec, type Correction, type Row } from "./model";
import {
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

export function AttendancePage() {
  const m = useMock();
  return m.role === "Admin" ? <AdminAttendance /> : <InternAttendance />;
}

// ---------- Intern ----------

type InternTab = "hari-ini" | "riwayat" | "koreksi";

function InternAttendance() {
  const search = useSearch({ strict: false }) as PageSearch;
  const [tab, setTab] = useState<InternTab>("hari-ini");
  const [correctionDate, setCorrectionDate] = useState<string | null>(null);
  useEffect(() => {
    if (search.tab === "riwayat" || search.tab === "koreksi" || search.tab === "hari-ini")
      setTab(search.tab);
  }, [search.tab]);
  return (
    <>
      <PageHeading
        title="Absensi"
        subtitle="Clock in, Daily Report, clock out, riwayat, dan koreksi absensi."
      />
      <Tabs
        label="Bagian absensi"
        value={tab}
        onChange={setTab}
        items={[
          { value: "hari-ini", label: "Hari Ini" },
          { value: "riwayat", label: "Riwayat" },
          { value: "koreksi", label: "Koreksi" },
        ]}
      />
      {tab === "hari-ini" && (
        <div className="grid gap-5 max-w-3xl">
          <TodayCard large />
          <DailyReportCard focus={search.open === "report"} />
        </div>
      )}
      {tab === "riwayat" && (
        <History
          onCorrect={(date) => {
            setCorrectionDate(date);
            setTab("koreksi");
          }}
        />
      )}
      {tab === "koreksi" && (
        <CorrectionTab presetDate={correctionDate} onPresetUsed={() => setCorrectionDate(null)} />
      )}
    </>
  );
}

function useLiveClock() {
  // Dimulai setelah mount agar teks server dan browser sama saat hydration.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return "--:--:--";
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

/** Kartu Hari Ini (dipakai di Dashboard dan tab Hari Ini). Tabel kondisi: design-intern.md 4.3. */
export function TodayCard({ large = false }: { large?: boolean }) {
  const m = useMock();
  const navigate = useNavigate();
  const clock = useLiveClock();
  const { state, rec, leave } = m.today(ME.Intern);
  const [checking, setChecking] = useState(false);
  const [locError, setLocError] = useState("");
  const [needReport, setNeedReport] = useState(false);
  const [early, setEarly] = useState(false);
  const reportSent = !!rec?.report;

  const clockIn = () => {
    setLocError("");
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      if (m.locationSim === "tidak-sesuai")
        return setLocError("Lokasi Anda belum sesuai. Clock in belum bisa dilakukan.");
      if (m.locationSim === "ditolak")
        return setLocError("Izinkan akses lokasi di browser untuk melakukan clock in.");
      if (m.locationSim === "gagal") return setLocError("Lokasi tidak dapat dibaca. Coba lagi.");
      const time = m.nowTime();
      m.setAtt((old) => [...old, { intern: ME.Intern, date: TODAY, clockIn: time, clockOut: "" }]);
      toast.success(`Clock in berhasil pukul ${time}.`, {
        description: "Jangan lupa mengisi Daily Report.",
      });
    }, 900);
  };
  const doClockOut = () => {
    const time = m.nowTime();
    m.setAtt((old) =>
      old.map((r) => (r.intern === ME.Intern && r.date === TODAY ? { ...r, clockOut: time } : r)),
    );
    setEarly(false);
    toast.success(`Clock out berhasil pukul ${time}. Terima kasih.`);
  };
  const clockOut = () => {
    const check = clockOutCheck(reportSent, m.nowTime(), m.workHours.end);
    if (check === "need-report") setNeedReport(true);
    else if (check === "confirm-early") setEarly(true);
    else doClockOut();
  };

  const statusLine =
    state === "Sudah Clock Out"
      ? `Hadir, clock out ${rec?.clockOut}`
      : state === "Libur"
        ? `Hari ini libur: ${m.holidayName(TODAY) ?? "akhir pekan"}`
        : state === "Izin"
          ? `Izin hari ini (${leave?.type.replace("Izin ", "")})`
          : state === "Di luar periode"
            ? "Di luar periode magang."
            : state;

  return (
    <section className={`panel today-card ${large ? "large" : ""}`}>
      <header className="panel-head">
        <div>
          <h2>Hari Ini</h2>
          <p>{formatDateLong(TODAY)}</p>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Jam kerja: {m.workHours.start} - {m.workHours.end}
        </span>
      </header>
      <div className="attendance-body">
        {large && <div className="time-display">{clock}</div>}
        <div className="attendance-state">
          <span>Status</span>
          <Status status={state === "Sudah Clock Out" ? "Hadir" : state} label={statusLine} />
        </div>
        {rec && (
          <div className="clock-times">
            <div>
              <small>Clock in</small>
              <strong>{rec.clockIn}</strong>
            </div>
            <div>
              <small>Clock out</small>
              <strong>{rec.clockOut || "--:--"}</strong>
            </div>
          </div>
        )}
        {state === "Belum Clock In" && (
          <>
            <Button className="clock-button" onClick={clockIn} disabled={checking}>
              <LogIn />
              {checking ? "Memeriksa lokasi..." : "Clock In"}
            </Button>
            {locError ? (
              <div className="loc-error" role="alert">
                <span>{locError}</span>
                <Button size="sm" variant="outline" onClick={clockIn}>
                  Coba lagi
                </Button>
              </div>
            ) : (
              <p className="attendance-note">
                <MapPin size={11} />
                Lokasi Anda akan diperiksa saat tombol ditekan.
              </p>
            )}
          </>
        )}
        {state === "Sudah Clock In" && (
          <Button className="clock-button" onClick={clockOut}>
            <LogOut />
            Clock Out
          </Button>
        )}
      </div>
      <Dialog open={needReport} onOpenChange={setNeedReport}>
        <DialogContent className="max-w-md">
          <DialogTitle>Daily Report belum dikirim</DialogTitle>
          <DialogDescription>Isi Daily Report dulu sebelum clock out.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNeedReport(false)}>
              Nanti
            </Button>
            <Button
              onClick={() => {
                setNeedReport(false);
                void navigate({ to: "/absensi", search: { tab: "hari-ini", open: "report" } });
              }}
            >
              Isi Daily Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Confirm
        open={early}
        title={`Belum jam pulang (${m.workHours.end})`}
        confirmLabel="Tetap Clock Out"
        onConfirm={doClockOut}
        onClose={() => setEarly(false)}
      >
        Tetap clock out sekarang? Setelah clock out, Daily Report terkunci dan tidak ada clock in
        kedua hari ini.
      </Confirm>
    </section>
  );
}

function DailyReportCard({ focus }: { focus: boolean }) {
  const m = useMock();
  const { state, rec } = m.today(ME.Intern);
  const ref = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);
  const [work, setWork] = useState(rec?.report?.work ?? "");
  const [notes, setNotes] = useState(rec?.report?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);
  const sent = !!rec?.report;
  const locked = state === "Sudah Clock Out";
  const save = () => {
    const err = validateReport(work);
    setError(err);
    if (err) return;
    m.setAtt((old) =>
      old.map((r) =>
        r.intern === ME.Intern && r.date === TODAY
          ? { ...r, report: { work: work.trim(), notes: notes.trim(), sentAt: m.nowIso() } }
          : r,
      ),
    );
    setEditing(false);
    toast.success(sent ? "Perubahan tersimpan." : "Daily Report terkirim.");
  };
  return (
    <section className="panel" ref={ref}>
      <header className="panel-head">
        <div>
          <h2>Daily Report - {formatDate(TODAY)}</h2>
          <p>Laporan tentang apa yang Anda kerjakan hari ini. Berbeda dari Task.</p>
        </div>
        {(state === "Sudah Clock In" || state === "Sudah Clock Out") && (
          <Status status={sent ? "Terkirim" : "Belum dikirim"} />
        )}
      </header>
      <div className="px-5 pb-5">
        {state === "Belum Clock In" && <Empty>Clock in dulu untuk mengisi Daily Report.</Empty>}
        {(state === "Libur" || state === "Izin" || state === "Di luar periode") && (
          <Empty>Tidak ada Daily Report hari ini.</Empty>
        )}
        {(state === "Sudah Clock In" || state === "Sudah Clock Out") &&
          (sent && !editing ? (
            <div className="grid gap-3">
              <DetailList
                items={[
                  ["Yang saya kerjakan", rec?.report?.work],
                  ["Kendala atau catatan", rec?.report?.notes || "-"],
                  ["Terakhir disimpan", formatShortTime(rec?.report?.sentAt ?? "")],
                ]}
              />
              {locked ? (
                <p className="text-[11px] text-muted-foreground">
                  Laporan terkunci setelah clock out.
                </p>
              ) : (
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil />
                    Ubah
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <label className="form-field">
                Yang saya kerjakan hari ini *
                <textarea value={work} onChange={(e) => setWork(e.target.value)} />
              </label>
              <label className="form-field">
                Kendala atau catatan (opsional)
                <textarea
                  className="!min-h-16"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <FormError text={error} />
              <div className="form-actions">
                <span className="text-[11px] text-muted-foreground mr-auto">
                  Dapat diubah sampai Anda clock out.
                </span>
                {editing && (
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Batal
                  </Button>
                )}
                <Button type="submit">Simpan Laporan</Button>
              </div>
            </form>
          ))}
      </div>
    </section>
  );
}

function History({ onCorrect }: { onCorrect: (date: string) => void }) {
  const m = useMock();
  const start = m.me.start ?? TODAY;
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [detail, setDetail] = useState<Row | null>(null);
  const rows = m.rowsFor(ME.Intern, `${month}-01`, `${month}-31`);
  const r = recap(rows);
  return (
    <Panel
      title="Riwayat absensi"
      subtitle="Status ditetapkan otomatis setelah 23:59. Hari ini masih berjalan."
      action={
        <MonthNav
          value={month}
          onChange={setMonth}
          min={start.slice(0, 7)}
          max={TODAY.slice(0, 7)}
        />
      }
    >
      <RecapStrip r={r} />
      {rows.length === 0 ? (
        <Empty>Belum ada data absensi pada bulan ini.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table clickable">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Status</th>
                <th>Daily Report</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                row.status === "Libur" ? (
                  <tr key={row.date} className="muted-row">
                    <td>{formatDate(row.date)}</td>
                    <td colSpan={5}>
                      <Status status="Libur" />{" "}
                      <span className="ml-2">{row.holiday ?? "Akhir pekan"}</span>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={row.date}
                    onClick={() => setDetail(row)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setDetail(row)}
                  >
                    <td>{formatDate(row.date)}</td>
                    <td>{row.clockIn || "-"}</td>
                    <td>{row.clockOut || "-"}</td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <Status status={row.status} />
                        {row.corrected && <Tag>Dikoreksi admin</Tag>}
                      </div>
                    </td>
                    <td>{row.report ? <Status status="Terkirim" /> : "-"}</td>
                    <td>
                      {row.date < TODAY && row.status !== "Izin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCorrect(row.date);
                          }}
                        >
                          Koreksi
                        </Button>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
      <DayDetail row={detail} onClose={() => setDetail(null)} />
    </Panel>
  );
}

export function RecapStrip({ r }: { r: ReturnType<typeof recap> }) {
  return (
    <div className="recap-strip">
      <span>
        Hadir <strong>{r.hadir}</strong>
      </span>
      <span>
        Izin <strong>{r.izin}</strong>
      </span>
      <span>
        Tidak Hadir <strong>{r.tidakHadir}</strong>
      </span>
      <span>
        Lupa Clock Out <strong>{r.lupa}</strong>
      </span>
      <span>
        Hari kerja <strong>{r.hariKerja}</strong>
      </span>
    </div>
  );
}

export function DayDetail({
  row,
  onClose,
  name,
}: {
  row: Row | null;
  onClose: () => void;
  name?: string | undefined;
}) {
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>
          {name ? `${name} · ` : ""}
          {row && formatDate(row.date)}
        </DialogTitle>
        <DialogDescription>Detail absensi dan Daily Report. Hanya baca.</DialogDescription>
        {row && (
          <DetailList
            items={[
              ["Clock in", row.clockIn || "-"],
              ["Clock out", row.clockOut || "-"],
              [
                "Status",
                <span key="s" className="flex gap-2">
                  <Status status={row.status} />
                  {row.corrected && <Tag>Dikoreksi admin</Tag>}
                </span>,
              ],
              ["Daily Report", row.report?.work ?? "Belum ada laporan"],
              ["Kendala atau catatan", row.report?.notes || "-"],
            ]}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CorrectionTab({
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
          <label className="form-field">
            Bukti (opsional)
            <input type="file" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
            <small className="text-muted-foreground">
              Jenis dan batas ukuran file ditetapkan tim backend.
            </small>
          </label>
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

// ---------- Admin ----------

function AdminAttendance() {
  const m = useMock();
  const [tab, setTab] = useState<"harian" | "rekap">("harian");
  const [date, setDate] = useState(TODAY);
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [mentor, setMentor] = useState("Semua");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Aktif");
  const [detail, setDetail] = useState<Row | null>(null);
  const interns = m.people
    .filter((p) => p.role === "Intern" && p.start)
    .filter((p) => mentor === "Semua" || p.mentor === mentor)
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const mentors = m.people.filter((p) => p.role === "Mentor");
  const daily = interns
    .map((p) => ({ p, row: m.rowsFor(p.name, date, date)[0] }))
    .filter((x): x is { p: (typeof interns)[number]; row: Row } => !!x.row);
  return (
    <>
      <PageHeading
        title="Absensi"
        subtitle="Data absensi seluruh intern dan rekap bulanan. Perubahan hanya lewat permintaan koreksi."
      />
      <Tabs
        label="Tampilan absensi"
        value={tab}
        onChange={setTab}
        items={[
          { value: "harian", label: "Harian" },
          { value: "rekap", label: "Rekap Bulanan" },
        ]}
      />
      <div className="toolbar">
        <div className="flex flex-wrap gap-3 items-center">
          <label className="search-field">
            <Search size={15} className="text-muted-foreground" />
            <input
              aria-label="Cari intern"
              placeholder="Cari intern"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            className="role-select"
            aria-label="Filter mentor"
            value={mentor}
            onChange={(e) => setMentor(e.target.value)}
          >
            <option value="Semua">Semua mentor</option>
            {mentors.map((x) => (
              <option key={x.id}>{x.name}</option>
            ))}
          </select>
          {tab === "rekap" && (
            <select
              className="role-select"
              aria-label="Filter status akun"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option>Aktif</option>
              <option>Nonaktif</option>
              <option>Semua</option>
            </select>
          )}
        </div>
        {tab === "harian" ? (
          <label className="date-chip">
            <CalendarDays size={14} />
            <input
              type="date"
              aria-label="Tanggal"
              value={date}
              max={TODAY}
              onChange={(e) => setDate(e.target.value || TODAY)}
            />
          </label>
        ) : (
          <MonthNav value={month} onChange={setMonth} min="2026-07" max={TODAY.slice(0, 7)} />
        )}
      </div>
      {tab === "harian" ? (
        <Panel
          title={formatDateLong(date)}
          subtitle={
            date === TODAY
              ? "Hari berjalan: yang belum clock in tampil Belum Clock In sampai 23:59."
              : "Status final."
          }
        >
          {daily.length === 0 ? (
            <Empty>Tidak ada intern dalam periode magang pada tanggal ini.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table clickable">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Mentor</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Status</th>
                    <th>Daily Report</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map(({ p, row }) => (
                    <tr
                      key={p.id}
                      onClick={() => setDetail(row)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setDetail(row)}
                    >
                      <td>{p.name}</td>
                      <td>{p.mentor}</td>
                      <td>{row.clockIn || "-"}</td>
                      <td>{row.clockOut || "-"}</td>
                      <td>
                        <span className="flex gap-2">
                          <Status status={row.status} />
                          {row.corrected && <Tag>Dikoreksi admin</Tag>}
                        </span>
                      </td>
                      <td>
                        {row.report ? (
                          <Status status="Terkirim" />
                        ) : row.status === "Libur" || row.status === "Izin" ? (
                          "-"
                        ) : (
                          <span className="text-muted-foreground">Belum ada laporan</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <Panel
          title={`Rekap ${formatMonth(month)}`}
          subtitle="Sabtu, Minggu, dan hari libur tidak dihitung hari kerja."
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intern</th>
                  <th>Mentor</th>
                  <th>Hadir</th>
                  <th>Izin</th>
                  <th>Tidak Hadir</th>
                  <th>Lupa Clock Out</th>
                  <th>Hari kerja</th>
                  <th>Akun</th>
                </tr>
              </thead>
              <tbody>
                {interns
                  .filter((p) => status === "Semua" || (status === "Aktif") === m.isActive(p))
                  .map((p) => {
                    const r = recap(m.rowsFor(p.name, `${month}-01`, `${month}-31`));
                    return (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.mentor}</td>
                        <td>{r.hadir}</td>
                        <td>{r.izin}</td>
                        <td>{r.tidakHadir}</td>
                        <td>{r.lupa}</td>
                        <td>{r.hariKerja}</td>
                        <td>
                          <Status status={m.isActive(p) ? "Aktif" : "Nonaktif"} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <DayDetail row={detail} name={detail?.intern} onClose={() => setDetail(null)} />
      <p className="text-[11px] text-muted-foreground mt-3">
        Admin tidak mengubah absensi langsung. Perubahan hanya lewat menu Koreksi.
      </p>
    </>
  );
}
