import { useNavigate, useSearch } from "@tanstack/react-router";
import { LogIn, LogOut, MapPin, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  checkLocation,
  clockOutCheck,
  distanceMeters,
  formatDate,
  formatDateLong,
  formatShortTime,
  locationMessage,
  validateReport,
} from "@/lib/mock-rules";
import { type PageSearch } from "@/lib/search";
import { CorrectionTab } from "@/components/internspace/intern/correction";
import { DayDetail, RecapStrip } from "@/components/internspace/shared/attendance-parts";
import {
  LOCATION_LABELS,
  type LocationSim,
  ME,
  type Report,
  type Row,
  SIM_POSITIONS,
  type Task,
  recap,
  useMock,
} from "@/components/internspace/shared/model";
import { Dashboard } from "@/components/internspace/shared/role-pages";
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
} from "@/components/internspace/shared/ui";

// ---------- Intern ----------
type InternTab = "hari-ini" | "riwayat" | "koreksi";

export function InternAttendance() {
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

/** Posisi intern: posisi contoh dari tombol Simulasi, atau GPS browser yang asli. */
function readPosition(
  sim: LocationSim,
): Promise<{ lat: number; lng: number } | "ditolak" | "gagal"> {
  if (sim === "ditolak" || sim === "gagal")
    return new Promise((done) => setTimeout(() => done(sim), 900));
  if (sim === "gps")
    return new Promise((done) => {
      if (!navigator.geolocation) return done("gagal");
      navigator.geolocation.getCurrentPosition(
        (p) => done({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (err) => done(err.code === err.PERMISSION_DENIED ? "ditolak" : "gagal"),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  const pos = SIM_POSITIONS[sim];
  return new Promise((done) => setTimeout(() => done(pos ?? "gagal"), 900));
}

/** Kontrol simulasi posisi di kartu Hari Ini, dengan jarak ke tiap kantor aktif dan radiusnya. */
function LocationSimBox({ kind }: { kind: "in" | "out" }) {
  const m = useMock();
  const pos = SIM_POSITIONS[m.locationSim];
  const active = m.offices.filter((o) => o.active);
  return (
    <div className="sim-box">
      <label className="sim-box-head">
        <span className="tag st-dark">Simulasi prototipe</span>
        Posisi intern
        <select
          aria-label="Simulasi posisi intern"
          value={m.locationSim}
          onChange={(e) => m.setLocationSim(e.target.value as LocationSim)}
        >
          {Object.entries(LOCATION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {active.length === 0 ? null : pos ? (
        <ul>
          {active.map((o) => {
            const d = Math.round(distanceMeters(pos, o));
            const radius = kind === "in" ? o.radiusIn : o.radiusOut;
            return (
              <li key={o.id}>
                <span>
                  {o.name}: <strong>{d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`}</strong>{" "}
                  (radius clock {kind} {radius} m)
                </span>
                <Status
                  status={d <= radius ? "Aktif" : "Ditolak"}
                  label={d <= radius ? "Dalam radius" : "Di luar radius"}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p>
          {m.locationSim === "gps"
            ? "Posisi dibaca dari browser saat tombol ditekan. Browser akan meminta izin lokasi."
            : "Pemeriksaan akan gagal dengan pesan sesuai dokumen."}
        </p>
      )}
    </div>
  );
}

/** Kartu Hari Ini (dipakai di Dashboard dan tab Hari Ini). Tabel kondisi: design-intern.md 4.3. */
export function TodayCard({ large = false }: { large?: boolean }) {
  const m = useMock();
  const navigate = useNavigate();
  const clock = useLiveClock();
  const { state, rec, leave } = m.today(ME.Intern);
  const [checking, setChecking] = useState<"in" | "out" | null>(null);
  const [locError, setLocError] = useState<{ kind: "in" | "out"; text: string } | null>(null);
  const [needReport, setNeedReport] = useState(false);
  const [early, setEarly] = useState(false);
  const reportSent = !!rec?.report;
  const noOffice = !m.offices.some((o) => o.active);

  /** Cek posisi terhadap radius kantor aktif. Clock in memakai radius clock in, clock out radius clock out. */
  const verify = (kind: "in" | "out", onOk: () => void) => {
    setLocError(null);
    setChecking(kind);
    void readPosition(m.locationSim).then((pos) => {
      setChecking(null);
      const result = typeof pos === "string" ? pos : checkLocation(pos, m.offices, kind);
      if (result === "ok") onOk();
      else setLocError({ kind, text: locationMessage(result, kind) });
    });
  };
  const clockIn = () =>
    verify("in", () => {
      const time = m.nowTime();
      m.setAtt((old) => [...old, { intern: ME.Intern, date: TODAY, clockIn: time, clockOut: "" }]);
      toast.success(`Clock in berhasil pukul ${time}.`, {
        description: "Jangan lupa mengisi Daily Report.",
      });
    });
  const doClockOut = () => {
    setEarly(false);
    verify("out", () => {
      const time = m.nowTime();
      m.setAtt((old) =>
        old.map((r) => (r.intern === ME.Intern && r.date === TODAY ? { ...r, clockOut: time } : r)),
      );
      toast.success(`Clock out berhasil pukul ${time}. Terima kasih.`);
    });
  };
  const clockOut = () => {
    const check = clockOutCheck(reportSent, m.nowTime(), m.workHours.end);
    if (check === "need-report") setNeedReport(true);
    else if (check === "confirm-early") setEarly(true);
    else doClockOut();
  };
  // Hasil cek lama tidak berlaku lagi setelah posisi simulasi diganti.
  useEffect(() => setLocError(null), [m.locationSim]);
  const errorBox = (kind: "in" | "out") =>
    locError?.kind === kind && (
      <div className="loc-error" role="alert">
        <span>{locError.text}</span>
        <Button size="sm" variant="outline" onClick={kind === "in" ? clockIn : doClockOut}>
          Coba lagi
        </Button>
      </div>
    );

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
            <Button className="clock-button" onClick={clockIn} disabled={!!checking || noOffice}>
              <LogIn />
              {checking === "in" ? "Memeriksa lokasi..." : "Clock In"}
            </Button>
            {noOffice ? (
              <div className="loc-error" role="alert">
                <span>{locationMessage("tanpa-kantor", "in")}</span>
              </div>
            ) : (
              errorBox("in") || (
                <p className="attendance-note">
                  <MapPin size={11} />
                  Lokasi Anda akan diperiksa saat tombol ditekan.
                </p>
              )
            )}
          </>
        )}
        {state === "Sudah Clock In" && (
          <>
            <Button className="clock-button" onClick={clockOut} disabled={!!checking}>
              <LogOut />
              {checking === "out" ? "Memeriksa lokasi..." : "Clock Out"}
            </Button>
            {errorBox("out") || (
              <p className="attendance-note">
                <MapPin size={11} />
                Lokasi diperiksa lagi saat clock out (radius clock out).
              </p>
            )}
          </>
        )}
        {(state === "Belum Clock In" || state === "Sudah Clock In") && (
          <LocationSimBox kind={state === "Belum Clock In" ? "in" : "out"} />
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

export function History({ onCorrect }: { onCorrect: (date: string) => void }) {
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
