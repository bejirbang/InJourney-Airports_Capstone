import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  addDays,
  formatDate,
  formatMonth,
  isWorkingDay,
  monthEnd,
  weekdayIndex,
} from "@/lib/mock-rules";
import {
  ApiError,
  type AdminAirport,
  type AdminHoliday,
  type WeeklyDay,
  officeApi,
  getToken,
  scheduleApi,
} from "@/lib/api";
import {
  Confirm,
  FormError,
  MonthNav,
  PageHeading,
  Panel,
  SimpleTable,
  Tabs,
} from "@/components/internspace/shared/ui";

function internToken(): string {
  const token = getToken();
  if (!token) throw new ApiError("Sesi berakhir. Masuk kembali.", 401);
  return token;
}

/**
 * Tanggal nyata hari ini (YYYY-MM-DD). Halaman ini menempel ke backend asli yang memvalidasi
 * tanggal berlaku dengan `after_or_equal:today`, jadi tidak memakai TODAY prototipe.
 */
const realToday = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// ---------- Pengaturan (design-admin.md Alur 7) ----------
export function SettingsPage() {
  const [tab, setTab] = useState<"jam" | "libur">("jam");
  return (
    <>
      <PageHeading
        title="Pengaturan"
        subtitle="Jam kerja dan kalender libur dipakai sistem untuk menentukan status kehadiran."
      />
      <Tabs
        label="Pengaturan"
        value={tab}
        onChange={setTab}
        items={[
          { value: "jam", label: "Jam Kerja" },
          { value: "libur", label: "Kalender Libur" },
        ]}
      />
      {tab === "jam" ? <WorkHoursTab /> : <HolidayTab />}
    </>
  );
}

// Jam kerja per bandara (backend: weekly-schedule per airport, bukan pengaturan global).
const DAY_LABEL = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Jadwal awal saat bandara belum punya set: Senin-Jumat 08:00-17:00. */
const defaultDays = (): WeeklyDay[] =>
  DAY_LABEL.map((_, i) => {
    const dow = i + 1;
    const workday = dow <= 5;
    return {
      day_of_week: dow,
      is_workday: workday,
      start_time: workday ? "08:00" : null,
      end_time: workday ? "17:00" : null,
    };
  });

function WorkHoursTab() {
  const queryClient = useQueryClient();
  const [airportId, setAirportId] = useState<number | null>(null);
  const [days, setDays] = useState<WeeklyDay[]>(defaultDays());
  const [from, setFrom] = useState(realToday());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const airportsQuery = useQuery({
    queryKey: ["admin", "airports"],
    queryFn: () => officeApi.airports(internToken()),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const airports: AdminAirport[] = useMemo(() => airportsQuery.data ?? [], [airportsQuery.data]);
  const airport = airports.find((a) => a.id === airportId) ?? null;

  // Pilih bandara pertama otomatis begitu daftar dimuat.
  useEffect(() => {
    if (airportId === null && airports.length > 0) setAirportId(airports[0]!.id);
  }, [airports, airportId]);

  const weeklyQuery = useQuery({
    queryKey: ["admin", "weekly-schedule", airportId],
    queryFn: () => scheduleApi.weekly(internToken(), airportId as number),
    enabled: airportId !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Jadwal yang berlaku sekarang = set terbaru; dipakai sebagai awal isian form.
  const current = weeklyQuery.data?.[0] ?? null;
  useEffect(() => {
    if (!current) return;
    setDays(
      defaultDays().map(
        (base) => current.days.find((d) => d.day_of_week === base.day_of_week) ?? base,
      ),
    );
  }, [current]);

  const toggleDay = (dow: number, workday: boolean) =>
    setDays((old) =>
      old.map((d) =>
        d.day_of_week === dow
          ? {
              ...d,
              is_workday: workday,
              start_time: workday ? (d.start_time ?? "08:00") : null,
              end_time: workday ? (d.end_time ?? "17:00") : null,
            }
          : d,
      ),
    );
  const setTime = (dow: number, key: "start_time" | "end_time", value: string) =>
    setDays((old) => old.map((d) => (d.day_of_week === dow ? { ...d, [key]: value } : d)));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (airportId === null) return setError("Pilih bandara dulu.");
    if (!from || from < realToday())
      return setError("Tanggal berlaku tidak boleh sebelum hari ini.");
    const bad = days.find((d) => d.is_workday && (!d.start_time || !d.end_time));
    if (bad)
      return setError(`Lengkapi jam masuk dan jam pulang ${DAY_LABEL[bad.day_of_week - 1]}.`);
    setError(null);
    setBusy(true);
    scheduleApi
      .saveWeekly(internToken(), airportId, { effective_from: from, days })
      .then(async (saved) => {
        await queryClient.invalidateQueries({ queryKey: ["admin", "weekly-schedule"] });
        toast.success("Jam kerja tersimpan.", {
          description: `Berlaku mulai ${formatDate(saved.effective_from)}. Hari lain mengikuti jadwal sebelumnya.`,
        });
      })
      .catch((saveErr: unknown) => {
        setError(
          saveErr instanceof ApiError
            ? saveErr.message
            : "Tidak bisa menghubungi server. Periksa koneksi dan API.",
        );
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="grid gap-5 max-w-2xl">
      <Panel
        title="Jam kerja"
        subtitle="Atur per bandara. Hari libur, jadwal khusus, dan tanggal sebelum jadwal pertama tetap non-kerja."
      >
        {airportsQuery.isPending ? (
          <p className="px-5 pb-5 text-[11px] text-muted-foreground">Memuat daftar bandara...</p>
        ) : airportsQuery.isError ? (
          <div className="px-5 pb-5 flex gap-2 items-center text-[11px] text-destructive">
            <span>Tidak bisa memuat daftar bandara.</span>
            <Button size="sm" variant="outline" onClick={() => void airportsQuery.refetch()}>
              Coba lagi
            </Button>
          </div>
        ) : airports.length === 0 ? (
          <p className="px-5 pb-5 text-[11px] text-muted-foreground">
            Belum ada bandara. Tambahkan bandara dan kantor dulu di menu Lokasi Kantor.
          </p>
        ) : (
          <form className="form-grid px-5 pb-5" onSubmit={save}>
            <label className="form-field">
              Bandara
              <select
                value={airportId ?? ""}
                onChange={(e) => {
                  setAirportId(Number(e.target.value));
                  setError(null);
                }}
              >
                {airports.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.city})
                  </option>
                ))}
              </select>
            </label>
            {weeklyQuery.isPending && airportId !== null ? (
              <p className="text-[11px] text-muted-foreground">Memuat jadwal mingguan...</p>
            ) : (
              <div className="grid gap-2">
                {days.map((d) => (
                  <div key={d.day_of_week} className="flex items-center gap-3 text-[12px]">
                    <label className="flex items-center gap-2 w-24">
                      <input
                        type="checkbox"
                        checked={d.is_workday}
                        onChange={(e) => toggleDay(d.day_of_week, e.target.checked)}
                      />
                      {DAY_LABEL[d.day_of_week - 1]}
                    </label>
                    {d.is_workday ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          aria-label={`Jam masuk ${DAY_LABEL[d.day_of_week - 1]}`}
                          value={d.start_time ?? ""}
                          onChange={(e) => setTime(d.day_of_week, "start_time", e.target.value)}
                        />
                        <span className="text-muted-foreground">-</span>
                        <input
                          type="time"
                          aria-label={`Jam pulang ${DAY_LABEL[d.day_of_week - 1]}`}
                          value={d.end_time ?? ""}
                          onChange={(e) => setTime(d.day_of_week, "end_time", e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Libur</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <label className="form-field">
              Berlaku mulai
              <input
                type="date"
                value={from}
                min={realToday()}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <p className="text-[11px] text-muted-foreground">
              Hari yang tidak diubah menyalin jadwal sebelumnya. Tanggal sebelum jadwal berlaku
              tidak berubah.
            </p>
            <FormError text={error} />
            <div className="form-actions">
              <Button type="submit" disabled={busy || weeklyQuery.isPending}>
                {busy ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        )}
      </Panel>
      <Panel title="Riwayat jam kerja">
        {weeklyQuery.isError ? (
          <p className="px-5 pb-5 text-[11px] text-destructive">Tidak bisa memuat riwayat.</p>
        ) : (
          <SimpleTable
            empty={airport ? `Belum ada jadwal untuk ${airport.name}.` : "-"}
            head={["Berlaku mulai", "Ringkasan"]}
            rows={(weeklyQuery.data ?? []).map((s) => [formatDate(s.effective_from), s.summary])}
          />
        )}
      </Panel>
    </div>
  );
}

function HolidayTab() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(realToday().slice(0, 7));
  const [form, setForm] = useState<AdminHoliday | "new" | null>(null);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingPast, setPendingPast] = useState<{
    id?: number;
    date: string;
    name: string;
  } | null>(null);
  const [del, setDel] = useState<AdminHoliday | null>(null);
  const editing = form && form !== "new" ? form : null;

  const holidaysQuery = useQuery({
    queryKey: ["admin", "holidays"],
    queryFn: () => scheduleApi.holidays(internToken()),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const holidays = useMemo(() => holidaysQuery.data ?? [], [holidaysQuery.data]);

  useEffect(() => {
    setDate(editing?.date ?? "");
    setName(editing?.name ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  /** Simpan; tanggal lampau minta konfirmasi server (reason confirm_recalculate). */
  const persist = async (input: { id?: number; date: string; name: string; confirm?: boolean }) => {
    try {
      const result = await scheduleApi.saveHoliday(
        internToken(),
        input.confirm === undefined
          ? { date: input.date, name: input.name }
          : { date: input.date, name: input.name, confirm: input.confirm },
        input.id,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "holidays"] });
      toast.success(result.message || "Perubahan tersimpan.");
      setForm(null);
      setPendingPast(null);
    } catch (saveErr: unknown) {
      if (saveErr instanceof ApiError && saveErr.reason === "confirm_recalculate") {
        setPendingPast(
          input.id === undefined
            ? { date: input.date, name: input.name }
            : { id: input.id, date: input.date, name: input.name },
        );
        return;
      }
      setError(
        saveErr instanceof ApiError
          ? saveErr.message
          : "Tidak bisa menghubungi server. Periksa koneksi dan API.",
      );
    }
  };

  const first = `${month}-01`;
  const last = monthEnd(month);
  const cells: (string | null)[] = [...Array<null>(weekdayIndex(first)).fill(null)];
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d);
  return (
    <div className="grid gap-5">
      <Panel
        title="Kalender libur"
        subtitle="Sabtu dan Minggu libur otomatis (abu-abu). Libur tambahan admin diberi warna dan nama."
        action={
          <div className="flex gap-2 items-center">
            <MonthNav value={month} onChange={setMonth} min="2026-07" max="2027-12" />
            <Button size="sm" onClick={() => setForm("new")}>
              <Plus />
              Tambah Libur
            </Button>
          </div>
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
            const h = holidays.find((x) => x.date === d);
            const weekend = !h && !isWorkingDay(d, []);
            return (
              <div
                key={d}
                className={`calendar-cell ${weekend ? "off" : ""} ${h ? "holiday" : ""} ${d === realToday() ? "today" : ""}`}
              >
                <span className="calendar-day">{Number(d.slice(8))}</span>
                {weekend && <span className="text-[9px]">(a)</span>}
                {h && <span className="text-[9px] font-semibold">{h.name}</span>}
              </div>
            );
          })}
        </div>
        <p className="px-5 pb-4 text-[10px] text-muted-foreground">
          Kalender ini mengikuti {formatMonth(month)}.
        </p>
      </Panel>
      <Panel title="Daftar libur tambahan">
        {holidaysQuery.isError ? (
          <p className="px-5 pb-5 text-[11px] text-destructive">Tidak bisa memuat daftar libur.</p>
        ) : (
          <SimpleTable
            empty="Belum ada libur tambahan."
            head={["Tanggal", "Nama libur", "Aksi"]}
            rows={holidays.map((h) => [
              formatDate(h.date),
              h.name,
              <span key="a" className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setForm(h)}>
                  <Pencil />
                  Ubah
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDel(h)}
                >
                  <Trash2 />
                  Hapus
                </Button>
              </span>,
            ])}
          />
        )}
      </Panel>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editing ? "Ubah Libur" : "Tambah Libur"}</DialogTitle>
          <DialogDescription>Sabtu dan Minggu tidak perlu dimasukkan.</DialogDescription>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              if (!date || !name.trim()) return setError("Tanggal dan nama libur wajib diisi.");
              if (!isWorkingDay(date, []))
                return setError("Sabtu dan Minggu sudah libur otomatis.");
              const input = { date, name: name.trim() };
              void persist(editing ? { id: editing.id, ...input } : input);
            }}
          >
            <label className="form-field">
              Tanggal *
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="form-field">
              Nama libur *
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <FormError text={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setForm(null)}>
                Batal
              </Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Confirm
        open={!!pendingPast}
        title="Tanggal ini sudah lewat"
        confirmLabel="Ya, hitung ulang"
        onClose={() => setPendingPast(null)}
        onConfirm={() => {
          if (!pendingPast) return;
          const base = { date: pendingPast.date, name: pendingPast.name };
          void persist(
            pendingPast.id === undefined
              ? { ...base, confirm: true }
              : { id: pendingPast.id, ...base, confirm: true },
          );
        }}
      >
        {pendingPast &&
          `${formatDate(pendingPast.date)} akan menjadi hari libur. Status presensi intern pada tanggal ini dihitung ulang (contoh: Tidak Hadir menjadi Libur).`}
      </Confirm>
      <Confirm
        open={!!del}
        title="Hapus hari libur?"
        confirmLabel="Hapus"
        destructive
        onClose={() => setDel(null)}
        onConfirm={() => {
          if (!del) return;
          scheduleApi
            .deleteHoliday(internToken(), del.id)
            .then(async () => {
              await queryClient.invalidateQueries({ queryKey: ["admin", "holidays"] });
              toast.success("Perubahan tersimpan.");
            })
            .catch((delErr: unknown) => {
              toast.error(
                delErr instanceof ApiError ? delErr.message : "Tidak bisa menghapus hari libur.",
              );
            })
            .finally(() => setDel(null));
        }}
      >
        {del &&
          `${formatDate(del.date)} (${del.name}) akan kembali menjadi hari kerja.${del.is_past ? " Status presensi tanggal itu dihitung ulang." : ""}`}
      </Confirm>
    </div>
  );
}
