import { Pencil, Plus, Trash2 } from "lucide-react";
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
  addDays,
  formatDate,
  formatMonth,
  formatShort,
  isWorkingDay,
  monthEnd,
  timeAfter,
  weekdayIndex,
} from "@/lib/mock-rules";
import { type Holiday, useMock } from "@/components/internspace/shared/model";
import {
  Confirm,
  FormError,
  MonthNav,
  PageHeading,
  Panel,
  SimpleTable,
  Status,
  Tabs,
} from "@/components/internspace/shared/ui";

// ---------- Pengaturan (design-admin.md Alur 7) ----------
export function SettingsPage() {
  const m = useMock();
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
      <p className="text-[11px] text-muted-foreground mt-3">
        Jam kerja saat ini: {m.workHours.start} - {m.workHours.end}.
      </p>
    </>
  );
}

function WorkHoursTab() {
  const m = useMock();
  const [start, setStart] = useState(m.workHours.start);
  const [end, setEnd] = useState(m.workHours.end);
  const [from, setFrom] = useState(addDays(TODAY, 1));
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-5 max-w-2xl">
      <Panel title="Jam kerja" subtitle="Berlaku untuk semua intern.">
        <form
          className="form-grid px-5 pb-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!timeAfter(start, end)) return setError("Jam pulang harus setelah jam masuk.");
            if (!from || from < TODAY)
              return setError("Tanggal berlaku tidak boleh sebelum hari ini.");
            setError(null);
            m.setWorkHistory((old) => [
              ...old.filter((w) => w.from !== from),
              { start, end, from },
            ]);
            m.log(
              "Kalender dan jam kerja",
              "Jam kerja",
              `Ubah jam kerja menjadi ${start} - ${end} mulai ${formatShort(from, true)}.`,
            );
            toast.success("Perubahan tersimpan.", {
              description: "Data absensi sebelumnya tidak berubah.",
            });
          }}
        >
          <div className="form-two">
            <label className="form-field">
              Jam masuk
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="form-field">
              Jam pulang
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <label className="form-field">
            Berlaku mulai
            <input type="date" value={from} min={TODAY} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Batas penetapan status otomatis: 23:59 (tidak dapat diubah).
          </p>
          <FormError text={error} />
          <div className="form-actions">
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Panel>
      <Panel title="Riwayat jam kerja">
        <SimpleTable
          empty="-"
          head={["Berlaku mulai", "Jam masuk", "Jam pulang"]}
          rows={[...m.workHistory]
            .sort((a, b) => b.from.localeCompare(a.from))
            .map((w) => [formatDate(w.from), w.start, w.end])}
        />
      </Panel>
    </div>
  );
}

function HolidayTab() {
  const m = useMock();
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [form, setForm] = useState<Holiday | "new" | null>(null);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<Holiday | null>(null);
  const [del, setDel] = useState<Holiday | null>(null);
  const editing = form && form !== "new" ? form : null;
  useEffect(() => {
    setDate(editing?.date ?? "");
    setName(editing?.name ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);
  const affected = (d: string) =>
    m.people.filter((p) => p.role === "Intern" && p.start && p.start <= d && p.end >= d).length;
  const save = (h: Holiday) => {
    m.setHolidays((old) =>
      [...old.filter((x) => x.date !== editing?.date && x.date !== h.date), h].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    );
    const recount = h.date < TODAY ? ` ${affected(h.date)} absensi dihitung ulang.` : "";
    m.log(
      "Kalender dan jam kerja",
      formatShort(h.date, true),
      `${editing ? "Ubah" : "Tambah"} libur "${h.name}".${recount}`,
    );
    toast.success("Perubahan tersimpan.");
    setForm(null);
    setPast(null);
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
            const h = m.holidays.find((x) => x.date === d);
            const weekend = !h && !isWorkingDay(d, []);
            return (
              <div
                key={d}
                className={`calendar-cell ${weekend ? "off" : ""} ${h ? "holiday" : ""} ${d === TODAY ? "today" : ""}`}
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
        <SimpleTable
          empty="Belum ada libur tambahan."
          head={["Tanggal", "Nama libur", "Aksi"]}
          rows={m.holidays.map((h) => [
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
              if (m.holidays.some((h) => h.date === date && h.date !== editing?.date))
                return setError("Tanggal ini sudah menjadi hari libur.");
              const h = { date, name: name.trim() };
              if (date < TODAY) setPast(h);
              else save(h);
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
        open={!!past}
        title="Tanggal ini sudah lewat"
        confirmLabel="Ya, hitung ulang"
        onClose={() => setPast(null)}
        onConfirm={() => past && save(past)}
      >
        {past &&
          `${formatShort(past.date, true)} akan menjadi hari libur. Status absensi ${affected(past.date)} intern pada tanggal ini akan dihitung ulang (contoh: Tidak Hadir menjadi Libur).`}
      </Confirm>
      <Confirm
        open={!!del}
        title="Hapus hari libur?"
        confirmLabel="Hapus"
        destructive
        onClose={() => setDel(null)}
        onConfirm={() => {
          if (!del) return;
          m.setHolidays((old) => old.filter((h) => h.date !== del.date));
          m.log(
            "Kalender dan jam kerja",
            formatShort(del.date, true),
            `Hapus libur "${del.name}".`,
          );
          setDel(null);
          toast.success("Perubahan tersimpan.");
        }}
      >
        {del &&
          `${formatDate(del.date)} (${del.name}) akan kembali menjadi hari kerja.${del.date < TODAY ? " Status absensi tanggal itu dihitung ulang." : ""}`}
      </Confirm>
    </div>
  );
}
