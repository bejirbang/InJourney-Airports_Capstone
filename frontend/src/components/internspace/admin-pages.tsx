import { useEffect, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Download,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TODAY,
  addDays,
  audienceValid,
  canDecideCorrection,
  canEditWarning,
  deactivateBlock,
  formatDate,
  formatDateTime,
  formatMonth,
  formatPeriod,
  formatRange,
  formatShort,
  formatShortTime,
  isWorkingDay,
  monthEnd,
  taskIsLate,
  timeAfter,
  validateAccount,
  weekdayIndex,
  workingDays,
  type Role,
} from "@/lib/mock-rules";
import type { PageSearch } from "@/lib/search";
import { ME, recap, shortName, useMock, type Correction, type Holiday, type Person } from "./model";
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
import { ExtendDialog } from "./dashboard";

const ADMIN_ID = 20;
const makeTempPassword = () =>
  `IJ-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(10 + Math.random() * 89)}`;

// ---------- Pengguna (design-admin.md Alur 2) ----------

export function UsersPage() {
  const m = useMock();
  const search = useSearch({ strict: false }) as PageSearch;
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"Semua" | Role>("Semua");
  const [status, setStatus] = useState<"Aktif" | "Nonaktif" | "Semua">("Aktif");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Person | "new" | null>(null);
  const [temp, setTemp] = useState<{ name: string; password: string } | null>(null);
  const actions = useAccountActions(setTemp, setForm);
  const list = m.people
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) || p.email.includes(query.toLowerCase()),
    )
    .filter((p) => role === "Semua" || p.role === role)
    .filter(
      (p) =>
        status === "Semua" ||
        (status === "Aktif") === m.isActive(p) ||
        (status === "Aktif" && p.active && p.role === "Intern" && p.start && p.start > TODAY),
    );
  const perPage = 10;
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const shown = list.slice((page - 1) * perPage, page * perPage);
  const selected = m.people.find((p) => String(p.id) === search.open);
  if (selected)
    return (
      <UserDetail
        person={selected}
        actions={actions}
        onBack={() => void navigate({ to: "/users" })}
        temp={temp}
        setTemp={setTemp}
        form={form}
        setForm={setForm}
      />
    );
  return (
    <>
      <PageHeading
        title="Pengguna"
        subtitle="Akun dibuat admin dengan email internal. Akun tidak dihapus, hanya dinonaktifkan."
        action={
          <Button onClick={() => setForm("new")}>
            <Plus />
            Tambah Akun
          </Button>
        }
      />
      <div className="toolbar">
        <label className="search-field">
          <Search size={15} className="text-muted-foreground" />
          <input
            aria-label="Cari pengguna"
            placeholder="Cari nama atau email"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="flex gap-2">
          <select
            className="role-select"
            aria-label="Filter role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as typeof role);
              setPage(1);
            }}
          >
            <option value="Semua">Role: Semua</option>
            <option>Intern</option>
            <option>Mentor</option>
            <option>Admin</option>
          </select>
          <select
            className="role-select"
            aria-label="Filter status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
          >
            <option value="Aktif">Status: Aktif</option>
            <option value="Nonaktif">Status: Nonaktif</option>
            <option value="Semua">Status: Semua</option>
          </select>
        </div>
      </div>
      <Panel
        title="Daftar pengguna"
        subtitle={`Menampilkan ${shown.length ? (page - 1) * perPage + 1 : 0}-${(page - 1) * perPage + shown.length} dari ${list.length}`}
      >
        {list.length === 0 ? (
          <Empty>Tidak ada pengguna yang sesuai filter.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Role</th>
                  <th>Mentor</th>
                  <th>Periode magang</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        to="/users"
                        search={{ open: String(p.id) }}
                        className="font-semibold hover:underline"
                      >
                        {p.name}
                      </Link>
                      <small className="block text-muted-foreground">{p.email}</small>
                    </td>
                    <td>{p.role}</td>
                    <td>{p.role === "Intern" ? p.mentor : "-"}</td>
                    <td>{p.role === "Intern" && p.start ? formatPeriod(p.start, p.end) : "-"}</td>
                    <td>
                      <AccountStatus person={p} />
                    </td>
                    <td>
                      <RowActions person={p} actions={actions} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex justify-end gap-1 p-4">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                size="sm"
                variant={n === page ? "secondary" : "ghost"}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}
          </div>
        )}
      </Panel>
      <AccountDialogs
        actions={actions}
        temp={temp}
        setTemp={setTemp}
        form={form}
        setForm={setForm}
      />
    </>
  );
}

function AccountStatus({ person }: { person: Person }) {
  const m = useMock();
  if (person.role === "Intern" && person.start && person.start > TODAY)
    return <Status status="Belum dimulai" />;
  return <Status status={m.isActive(person) ? "Aktif" : "Nonaktif"} />;
}

type Actions = ReturnType<typeof useAccountActions>;

function useAccountActions(
  setTemp: (t: { name: string; password: string } | null) => void,
  setForm: (f: Person | "new" | null) => void,
) {
  const m = useMock();
  const [mentorFor, setMentorFor] = useState<Person | null>(null);
  const [resetFor, setResetFor] = useState<Person | null>(null);
  const [deactivate, setDeactivate] = useState<Person | null>(null);
  const [extend, setExtend] = useState<Person | null>(null);
  const toggle = (p: Person) => {
    if (m.isActive(p) || (p.active && p.start && p.start > TODAY)) {
      const block = deactivateBlock(
        p,
        ADMIN_ID,
        m.people.filter((x) => m.isActive(x) || x.role !== "Intern"),
      );
      if (block) {
        toast.error(block);
        return;
      }
      setDeactivate(p);
    } else if (p.role === "Intern" && p.end < TODAY) {
      toast.info("Aktifkan kembali intern dengan memperbarui tanggal selesai magang.");
      setExtend(p);
    } else {
      m.setPeople((old) => old.map((x) => (x.id === p.id ? { ...x, active: true } : x)));
      m.log("Akun", p.name, "Aktifkan akun.");
      toast.success("Perubahan tersimpan.");
    }
  };
  return {
    mentorFor,
    setMentorFor,
    resetFor,
    setResetFor,
    deactivate,
    setDeactivate,
    extend,
    setExtend,
    toggle,
    setTemp,
    setForm,
  };
}

function RowActions({ person, actions }: { person: Person; actions: Actions }) {
  const m = useMock();
  const active = m.isActive(person) || (person.active && !!person.start && person.start > TODAY);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={`Aksi untuk ${person.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to="/users" search={{ open: String(person.id) }}>
            Lihat detail
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.setForm(person)}>Ubah data</DropdownMenuItem>
        {person.role === "Intern" && (
          <DropdownMenuItem onSelect={() => actions.setMentorFor(person)}>
            Ganti mentor
          </DropdownMenuItem>
        )}
        {person.role === "Intern" && (
          <DropdownMenuItem onSelect={() => actions.setExtend(person)}>
            Perpanjang magang
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => actions.setResetFor(person)}>
          Reset password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={active ? "text-destructive" : ""}
          onSelect={() => actions.toggle(person)}
        >
          {active ? "Nonaktifkan" : "Aktifkan"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountDialogs({
  actions,
  temp,
  setTemp,
  form,
  setForm,
}: {
  actions: Actions;
  temp: { name: string; password: string } | null;
  setTemp: (t: { name: string; password: string } | null) => void;
  form: Person | "new" | null;
  setForm: (f: Person | "new" | null) => void;
}) {
  const m = useMock();
  const d = actions.deactivate;
  return (
    <>
      <AccountForm
        target={form}
        onClose={() => setForm(null)}
        onCreated={(name, password) => setTemp({ name, password })}
      />
      <MentorDialog person={actions.mentorFor} onClose={() => actions.setMentorFor(null)} />
      <ExtendDialog person={actions.extend} onClose={() => actions.setExtend(null)} />
      <Confirm
        open={!!actions.resetFor}
        title={`Reset password ${actions.resetFor?.name ?? ""}?`}
        confirmLabel="Ya, reset"
        onClose={() => actions.setResetFor(null)}
        onConfirm={() => {
          const p = actions.resetFor;
          if (!p) return;
          const password = makeTempPassword();
          m.log("Akun", p.name, "Reset password.");
          actions.setResetFor(null);
          setTemp({ name: p.name, password });
        }}
      >
        Sistem membuat password sementara baru. Pengguna wajib mengganti password saat login
        berikutnya. Admin tidak mengetik password sendiri.
      </Confirm>
      <Confirm
        open={!!d}
        title={`Nonaktifkan akun ${d?.name ?? ""}?`}
        confirmLabel="Nonaktifkan"
        destructive
        onClose={() => actions.setDeactivate(null)}
        onConfirm={() => {
          if (!d) return;
          m.setPeople((old) => old.map((x) => (x.id === d.id ? { ...x, active: false } : x)));
          m.log("Akun", d.name, "Nonaktifkan akun.");
          actions.setDeactivate(null);
          toast.success("Perubahan tersimpan.");
        }}
      >
        <ul className="list-disc pl-5">
          <li>Tidak bisa login{d?.role === "Intern" ? " dan clock in" : ""}.</li>
          <li>Data tetap bisa dilihat mentor dan admin.</li>
          {d?.role === "Intern" && (
            <li>Mentor tetap bisa memeriksa Task yang sudah dikumpulkan.</li>
          )}
        </ul>
      </Confirm>
      <Dialog open={!!temp} onOpenChange={() => undefined}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle>Password sementara - {temp?.name}</DialogTitle>
          <DialogDescription>
            Password sementara hanya tampil sekali. Salin sebelum menutup.
          </DialogDescription>
          <div className="temp-password">
            <code>{temp?.password}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(temp?.password ?? "");
                toast.success("Password disalin.");
              }}
            >
              <Copy />
              Salin
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sampaikan email internal dan password ini ke pengguna. Pengguna wajib mengganti password
            saat login pertama.
          </p>
          <DialogFooter>
            <Button onClick={() => setTemp(null)}>Sudah disalin, tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccountForm({
  target,
  onClose,
  onCreated,
}: {
  target: Person | "new" | null;
  onClose: () => void;
  onCreated: (name: string, password: string) => void;
}) {
  const m = useMock();
  const editing = target && target !== "new" ? target : null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Intern");
  const [mentor, setMentor] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setName(editing?.name ?? "");
    setEmail(editing?.email ?? "");
    setRole(editing?.role ?? "Intern");
    setMentor(editing?.mentor && editing.mentor !== "—" ? editing.mentor : "");
    setStart(editing?.start ?? "");
    setEnd(editing && editing.end !== "—" ? editing.end : "");
    setTitle(editing?.title ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const mentors = m.people.filter((p) => p.role === "Mentor" && p.active);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{editing ? `Ubah data - ${editing.name}` : "Tambah Akun"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Role tidak bisa diubah. Mentor diubah lewat Ganti mentor."
            : "Password sementara dibuat otomatis oleh sistem."}
        </DialogDescription>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const input = {
              name,
              email,
              role,
              mentor: editing ? editing.mentor : mentor,
              start,
              end,
            };
            const err = validateAccount(input, m.people, editing?.id);
            setError(err);
            if (err) return;
            if (editing) {
              m.setPeople((old) =>
                old.map((p) =>
                  p.id === editing.id
                    ? {
                        ...p,
                        name: name.trim(),
                        email: email.trim(),
                        title: title.trim() || p.title,
                        ...(role === "Intern" ? { start, end } : {}),
                      }
                    : p,
                ),
              );
              m.log("Akun", name.trim(), "Ubah data akun.");
              toast.success("Perubahan tersimpan.");
            } else {
              const person: Person = {
                id: Date.now(),
                name: name.trim(),
                email: email.trim(),
                role,
                active: true,
                mentor: role === "Intern" ? mentor : "—",
                end: role === "Intern" ? end : "—",
                title: title.trim() || `${role}`,
                ...(role === "Intern" ? { start } : {}),
              };
              m.setPeople((old) => [...old, person]);
              m.log("Akun", person.name, `Tambah akun ${role}.`);
              onCreated(person.name, makeTempPassword());
            }
            onClose();
          }}
        >
          <label className="form-field">
            Nama lengkap *
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="form-field">
            Email internal *
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <fieldset className="form-field">
            <legend className="mb-2">Role *</legend>
            <div className="flex gap-5">
              {(["Intern", "Mentor", "Admin"] as const).map((r) => (
                <label key={r} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={role === r}
                    disabled={!!editing}
                    onChange={() => setRole(r)}
                  />
                  {r}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="form-field">
            Jabatan atau bidang
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: UI/UX Design Intern"
            />
          </label>
          {role === "Intern" && (
            <>
              {!editing && (
                <label className="form-field">
                  Mentor *
                  <select value={mentor} onChange={(e) => setMentor(e.target.value)}>
                    <option value="">Pilih mentor</option>
                    {mentors.map((p) => (
                      <option key={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="form-two">
                <label className="form-field">
                  Tanggal mulai *
                  <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </label>
                <label className="form-field">
                  Tanggal selesai *
                  <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                </label>
              </div>
            </>
          )}
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MentorDialog({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const m = useMock();
  const [mentor, setMentor] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setMentor("");
    setError(null);
  }, [person?.id]);
  if (!person) return <Dialog open={false} />;
  const activeTasks = m.tasks.filter((t) => t.intern === person.name && t.status !== "Done");
  const comments = activeTasks.reduce((n, t) => n + t.comments.length, 0);
  const pending = m.leaves.filter((l) => l.intern === person.name && l.status === "Pending");
  const options = m.people.filter(
    (p) => p.role === "Mentor" && p.active && p.name !== person.mentor,
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Ganti Mentor - {person.name}</DialogTitle>
        <DialogDescription>
          Mentor saat ini: {person.mentor}. Satu intern tepat satu mentor.
        </DialogDescription>
        <label className="form-field">
          Mentor baru *
          <select value={mentor} onChange={(e) => setMentor(e.target.value)}>
            <option value="">Pilih mentor</option>
            {options.map((p) => (
              <option key={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <div className="banner muted flex-col !items-start">
          <strong>Yang akan dipindahkan ke mentor baru:</strong>
          <span>
            - {activeTasks.length} Task aktif beserta {comments} komentar
          </span>
          <span>- {pending.length} izin Pending</span>
          <span>Riwayat lama tetap tersimpan.</span>
        </div>
        <FormError text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              if (!mentor) return setError("Pilih mentor baru.");
              const old = person.mentor;
              m.setPeople((list) =>
                list.map((p) =>
                  p.id === person.id
                    ? { ...p, mentor, formerMentors: [...(p.formerMentors ?? []), old] }
                    : p,
                ),
              );
              m.setTasks((list) =>
                list.map((t) =>
                  t.intern === person.name && t.status !== "Done" ? { ...t, mentor } : t,
                ),
              );
              if (person.name === ME.Intern)
                m.notify("Intern", `Mentor Anda sekarang ${mentor}.`, "/");
              if (mentor === ME.Mentor)
                m.notify(
                  "Mentor",
                  `Intern ${person.name} kini menjadi bimbingan Anda.`,
                  "/intern-saya",
                );
              if (old === ME.Mentor)
                m.notify(
                  "Mentor",
                  `Intern ${person.name} tidak lagi menjadi bimbingan Anda.`,
                  "/intern-saya",
                );
              m.log("Akun", person.name, `Ganti mentor dari ${old} ke ${mentor}.`);
              toast.success("Perubahan tersimpan. Mentor baru dan intern sudah diberi tahu.");
              onClose();
            }}
          >
            Pindahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type UserTab = "profil" | "absensi" | "izin" | "koreksi" | "warning";

function UserDetail({
  person,
  actions,
  onBack,
  temp,
  setTemp,
  form,
  setForm,
}: {
  person: Person;
  actions: Actions;
  onBack: () => void;
  temp: { name: string; password: string } | null;
  setTemp: (t: { name: string; password: string } | null) => void;
  form: Person | "new" | null;
  setForm: (f: Person | "new" | null) => void;
}) {
  const m = useMock();
  const [tab, setTab] = useState<UserTab>("profil");
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const isIntern = person.role === "Intern";
  const rows = isIntern
    ? m.rowsFor(person.name, `${month}-01`, `${month}-31`).filter((r) => r.status !== "Libur")
    : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <Button variant="link" className="p-0 h-auto mb-2" onClick={onBack}>
            <ArrowLeft />
            Pengguna
          </Button>
          <h1>{person.name}</h1>
          <p className="flex flex-wrap gap-3 items-center">
            <AccountStatus person={person} />
            <span>{person.role}</span>
            {isIntern && <span>Mentor: {person.mentor}</span>}
            {isIntern && person.start && (
              <span>Periode: {formatPeriod(person.start, person.end)}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setForm(person)}>
            <Pencil />
            Ubah
          </Button>
          <RowActions person={person} actions={actions} />
        </div>
      </div>
      {isIntern && (
        <Tabs
          label="Detail pengguna"
          value={tab}
          onChange={setTab}
          items={[
            { value: "profil", label: "Profil" },
            { value: "absensi", label: "Absensi" },
            { value: "izin", label: "Izin" },
            { value: "koreksi", label: "Koreksi" },
            { value: "warning", label: "Warning" },
          ]}
        />
      )}
      {tab === "profil" && (
        <Panel title="Profil">
          <div className="px-5 pb-5">
            <DetailList
              items={[
                ["Email internal", person.email],
                ["Role", person.role],
                ["Jabatan atau bidang", person.title],
                ["Telepon", person.phone ?? "-"],
                ...(isIntern
                  ? ([
                      ["Mentor", person.mentor],
                      [
                        "Periode magang",
                        person.start ? formatPeriod(person.start, person.end) : "-",
                      ],
                      ["Mentor sebelumnya", person.formerMentors?.join(", ") || "-"],
                    ] as [string, string][])
                  : []),
                ...(person.role === "Mentor"
                  ? ([
                      [
                        "Intern bimbingan",
                        m
                          .internsOf(person.name)
                          .map((p) => p.name)
                          .join(", ") || "-",
                      ],
                    ] as [string, string][])
                  : []),
              ]}
            />
          </div>
        </Panel>
      )}
      {tab === "absensi" && (
        <Panel
          title="Absensi"
          action={
            <MonthNav
              value={month}
              onChange={setMonth}
              min={(person.start ?? TODAY).slice(0, 7)}
              max={TODAY.slice(0, 7)}
            />
          }
        >
          <div className="recap-strip">
            {Object.entries(recap(m.rowsFor(person.name, `${month}-01`, `${month}-31`)))
              .filter(([k]) => k !== "laporan")
              .map(([k, v]) => (
                <span key={k}>
                  {
                    {
                      hadir: "Hadir",
                      izin: "Izin",
                      tidakHadir: "Tidak Hadir",
                      lupa: "Lupa Clock Out",
                      hariKerja: "Hari kerja",
                    }[k]
                  }{" "}
                  <strong>{v}</strong>
                </span>
              ))}
          </div>
          {rows.length === 0 ? (
            <Empty>Belum ada data absensi pada bulan ini.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Status</th>
                    <th>Daily Report</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date}>
                      <td>{formatDate(r.date)}</td>
                      <td>{r.clockIn || "-"}</td>
                      <td>{r.clockOut || "-"}</td>
                      <td>
                        <span className="flex gap-2">
                          <Status status={r.status} />
                          {r.corrected && <Tag>Dikoreksi admin</Tag>}
                        </span>
                      </td>
                      <td className="max-w-xs truncate">{r.report?.work ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      {tab === "izin" && (
        <Panel title="Izin">
          <SimpleTable
            empty="Belum ada pengajuan izin."
            head={["Jenis", "Tanggal", "Status", "Diproses oleh", "Catatan"]}
            rows={m.leaves
              .filter((l) => l.intern === person.name)
              .map((l) => [
                l.type,
                formatRange(l.start, l.end),
                <Status key="s" status={l.status} />,
                l.by ?? "-",
                l.note ?? "-",
              ])}
          />
        </Panel>
      )}
      {tab === "koreksi" && (
        <Panel title="Koreksi">
          <SimpleTable
            empty="Belum ada permintaan koreksi."
            head={["Tanggal absensi", "Diajukan", "Status", "Catatan admin"]}
            rows={m.corrections
              .filter((c) => c.intern === person.name)
              .map((c) => [
                formatShort(c.date, true),
                formatShortTime(c.submitted),
                <Status key="s" status={c.status} />,
                c.note ?? "-",
              ])}
          />
        </Panel>
      )}
      {tab === "warning" && <WarningList intern={person.name} />}
      <AccountDialogs
        actions={actions}
        temp={temp}
        setTemp={setTemp}
        form={form}
        setForm={setForm}
      />
    </>
  );
}

function SimpleTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

// ---------- Warning (design-admin.md Alur 8) ----------

export function WarningsPage() {
  const m = useMock();
  const interns = m.people.filter((p) => p.role === "Intern");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(interns[0]?.name ?? "");
  return (
    <>
      <PageHeading
        title="Warning"
        subtitle="Catatan peringatan sederhana tanpa level. Hanya admin yang melihatnya."
      />
      <div className="split">
        <Panel title="Intern">
          <div className="px-4 pb-3">
            <label className="search-field">
              <Search size={15} className="text-muted-foreground" />
              <input
                aria-label="Cari intern"
                placeholder="Cari intern"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="pick-list">
            {interns
              .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={selected === p.name ? "active" : ""}
                  onClick={() => setSelected(p.name)}
                >
                  {p.name}
                  <span>{m.warnings.filter((w) => w.intern === p.name).length}</span>
                </button>
              ))}
          </div>
        </Panel>
        {selected && <WarningList intern={selected} />}
      </div>
    </>
  );
}

function WarningList({ intern }: { intern: string }) {
  const m = useMock();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const list = m.warnings
    .filter((w) => w.intern === intern)
    .sort((a, b) => b.created.localeCompare(a.created));
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Warning - {intern} <Tag tone="dark">Hanya terlihat oleh admin</Tag>
        </span>
      }
      action={
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus />
          Tambah Catatan
        </Button>
      }
    >
      {adding && (
        <form
          className="form-grid px-5 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            m.setWarnings((old) => [
              ...old,
              { id: Date.now(), intern, text: text.trim(), author: ME.Admin, created: m.nowIso() },
            ]);
            m.log("Warning", intern, "Tambah catatan warning.");
            setText("");
            setAdding(false);
            toast.success("Catatan tersimpan. Tidak ada notifikasi ke intern atau mentor.");
          }}
        >
          <textarea
            className="border border-border rounded-md p-3 text-xs min-h-20"
            aria-label="Catatan warning"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!text.trim()}>
              Simpan
            </Button>
          </div>
        </form>
      )}
      {list.length === 0 && !adding && <Empty>Belum ada catatan untuk intern ini.</Empty>}
      {list.map((w) => {
        const editable = canEditWarning(w.author, ME.Admin, w.created, m.nowIso());
        return (
          <div className="announcement" key={w.id}>
            <div className="flex-1">
              <h3>
                {formatShort(w.created, true)} - {w.author}
              </h3>
              {editId === w.id ? (
                <div className="grid gap-2 mt-2">
                  <textarea
                    className="border border-border rounded-md p-2 text-xs"
                    aria-label="Ubah catatan"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="form-actions">
                    <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                      Batal
                    </Button>
                    <Button
                      size="sm"
                      disabled={!editText.trim()}
                      onClick={() => {
                        m.setWarnings((old) =>
                          old.map((x) => (x.id === w.id ? { ...x, text: editText.trim() } : x)),
                        );
                        m.log("Warning", intern, "Ubah catatan warning.");
                        setEditId(null);
                        toast.success("Perubahan tersimpan.");
                      }}
                    >
                      Simpan
                    </Button>
                  </div>
                </div>
              ) : (
                <p>{w.text}</p>
              )}
              <small>{editable ? "Dapat diubah pembuat dalam 24 jam." : "Terkunci."}</small>
            </div>
            {editable && editId !== w.id && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Ubah catatan"
                onClick={() => {
                  setEditId(w.id);
                  setEditText(w.text);
                }}
              >
                <Pencil />
              </Button>
            )}
          </div>
        );
      })}
    </Panel>
  );
}

// ---------- Pengumuman (design-admin.md Alur 9) ----------

export function AnnouncementsPage() {
  const m = useMock();
  const [form, setForm] = useState<number | "new" | null>(null);
  const [del, setDel] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [intern, setIntern] = useState(true);
  const [mentor, setMentor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = typeof form === "number" ? m.announcements.find((a) => a.id === form) : undefined;
  useEffect(() => {
    setTitle(editing?.title ?? "");
    setText(editing?.text ?? "");
    setIntern(editing ? editing.audience.includes("Intern") : true);
    setMentor(editing ? editing.audience.includes("Mentor") : false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);
  const toDelete = m.announcements.find((a) => a.id === del);
  return (
    <>
      <PageHeading
        title="Pengumuman"
        subtitle="Pengumuman tampil di bell icon role penerima."
        action={
          <Button onClick={() => setForm("new")}>
            <Plus />
            Buat Pengumuman
          </Button>
        }
      />
      <Panel title="Daftar pengumuman">
        <SimpleTable
          empty="Belum ada pengumuman."
          head={["Judul", "Penerima", "Tanggal", "Aksi"]}
          rows={[...m.announcements]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((a) => [
              <span key="t">
                <strong>{a.title}</strong>
                <small className="block text-muted-foreground max-w-md truncate">{a.text}</small>
              </span>,
              a.audience.replace(" & ", ", "),
              formatShort(a.date, true),
              <span key="a" className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setForm(a.id)}>
                  Ubah
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDel(a.id)}
                >
                  Hapus
                </Button>
              </span>,
            ])}
        />
      </Panel>
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogTitle>{editing ? "Ubah Pengumuman" : "Buat Pengumuman"}</DialogTitle>
          <DialogDescription>Perubahan tampil ke penerima.</DialogDescription>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || !text.trim()) return setError("Judul dan isi wajib diisi.");
              if (!audienceValid(intern, mentor)) return setError("Pilih minimal satu penerima.");
              const audience = intern && mentor ? "Intern & Mentor" : intern ? "Intern" : "Mentor";
              if (editing) {
                m.setAnnouncements((old) =>
                  old.map((a) =>
                    a.id === editing.id
                      ? { ...a, title: title.trim(), text: text.trim(), audience }
                      : a,
                  ),
                );
                m.log("Pengumuman", title.trim(), "Ubah pengumuman.");
                toast.success("Perubahan tersimpan.");
              } else {
                m.setAnnouncements((old) => [
                  ...old,
                  {
                    id: Date.now(),
                    title: title.trim(),
                    text: text.trim(),
                    audience,
                    date: TODAY,
                    author: ME.Admin,
                  },
                ]);
                if (intern) m.notify("Intern", `Pengumuman: ${title.trim()}`, "/");
                if (mentor) m.notify("Mentor", `Pengumuman: ${title.trim()}`, "/");
                m.log(
                  "Pengumuman",
                  title.trim(),
                  `Buat pengumuman untuk ${audience.replace(" & ", " dan ")}.`,
                );
                toast.success("Pengumuman terkirim ke bell icon penerima.");
              }
              setForm(null);
            }}
          >
            <label className="form-field">
              Judul *
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="form-field">
              Isi *
              <textarea value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <fieldset className="form-field">
              <legend className="mb-2">Penerima *</legend>
              <div className="flex gap-5">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={intern}
                    onChange={(e) => setIntern(e.target.checked)}
                  />
                  Intern
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={mentor}
                    onChange={(e) => setMentor(e.target.checked)}
                  />
                  Mentor
                </label>
              </div>
            </fieldset>
            <FormError text={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setForm(null)}>
                Batal
              </Button>
              <Button type="submit">{editing ? "Simpan" : "Kirim"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Confirm
        open={!!toDelete}
        title="Hapus pengumuman?"
        confirmLabel="Hapus"
        destructive
        onClose={() => setDel(null)}
        onConfirm={() => {
          if (!toDelete) return;
          m.setAnnouncements((old) => old.filter((a) => a.id !== toDelete.id));
          m.log("Pengumuman", toDelete.title, "Hapus pengumuman.");
          setDel(null);
          toast.success("Pengumuman dihapus.");
        }}
      >
        "{toDelete?.title}" akan dihapus dan tidak lagi tampil ke penerima.
      </Confirm>
    </>
  );
}

// ---------- Laporan PDF (design-admin.md Alur 10) ----------

type ReportType = "absensi" | "izin" | "task";

export function ReportsPage() {
  const m = useMock();
  const [type, setType] = useState<ReportType | "">("");
  const [from, setFrom] = useState(`${TODAY.slice(0, 7)}-01`);
  const [to, setTo] = useState(TODAY);
  const [intern, setIntern] = useState("Semua");
  const [mentor, setMentor] = useState("Semua");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    head: string[];
    rows: React.ReactNode[][];
    title: string;
  } | null>(null);
  const interns = m.people
    .filter((p) => p.role === "Intern" && p.start)
    .filter(
      (p) =>
        (intern === "Semua" || p.name === intern) && (mentor === "Semua" || p.mentor === mentor),
    );
  const names = interns.map((p) => p.name);
  const build = () => {
    if (!type) return setError("Pilih jenis laporan.");
    if (!from || !to || to < from) return setError("Periode tidak valid.");
    setError(null);
    let head: string[] = [];
    let rows: React.ReactNode[][] = [];
    if (type === "absensi") {
      head = ["Intern", "Hadir", "Izin", "Tidak Hadir", "Lupa Clock Out", "Hari kerja"];
      rows = interns
        .map((p) => ({ p, r: recap(m.rowsFor(p.name, from, to)) }))
        .filter((x) => x.r.hariKerja > 0)
        .map(({ p, r }) => [p.name, r.hadir, r.izin, r.tidakHadir, r.lupa, r.hariKerja]);
    } else if (type === "izin") {
      head = ["Intern", "Jenis", "Tanggal", "Hari kerja", "Status", "Pemroses", "Catatan"];
      rows = m.leaves
        .filter((l) => names.includes(l.intern) && l.start <= to && l.end >= from)
        .map((l) => [
          l.intern,
          l.type,
          formatRange(l.start, l.end),
          workingDays(l.start, l.end, m.holidayDates),
          l.status,
          l.by ?? "-",
          l.note ?? "-",
        ]);
    } else {
      head = ["Intern", "Mentor", "Judul Task", "Status", "Terlambat"];
      rows = m.tasks
        .filter(
          (t) => names.includes(t.intern) && t.due.slice(0, 10) >= from && t.due.slice(0, 10) <= to,
        )
        .map((t) => [
          t.intern,
          t.mentor,
          t.title,
          t.status,
          taskIsLate(t.due, t.status, t.submittedAt) ? "Terlambat" : "-",
        ]);
    }
    if (rows.length === 0) {
      setPreview(null);
      return setError("Tidak ada data pada periode ini.");
    }
    const label = { absensi: "Rekap Absensi", izin: "Rekap Izin", task: "Rekap Task" }[type];
    setPreview({
      head,
      rows,
      title: `${label} · ${formatShort(from, true)} - ${formatShort(to, true)}`,
    });
    m.log("Laporan", label, `Export PDF ${formatShort(from, true)} - ${formatShort(to, true)}.`);
    toast.success("PDF disiapkan.", {
      description: "Prototipe menampilkan isi laporan. Unduhan PDF dikerjakan tim backend.",
    });
  };
  return (
    <>
      <PageHeading
        title="Laporan (Export PDF)"
        subtitle="Format PDF saja. Hanya admin yang bisa export."
      />
      <Panel title="Buat laporan">
        <div className="form-grid px-5 pb-5 max-w-xl">
          <fieldset className="form-field">
            <legend className="mb-2">Jenis laporan *</legend>
            <div className="radio-list">
              {(
                [
                  ["absensi", "Rekap Absensi"],
                  ["izin", "Rekap Izin"],
                  ["task", "Rekap Task"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className="radio-item">
                  <input
                    type="radio"
                    name="report-type"
                    checked={type === v}
                    onChange={() => setType(v)}
                  />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-two">
            <label className="form-field">
              Periode dari *
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="form-field">
              Sampai *
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <div className="form-two">
            <label className="form-field">
              Intern
              <select value={intern} onChange={(e) => setIntern(e.target.value)}>
                <option value="Semua">Semua</option>
                {m.people
                  .filter((p) => p.role === "Intern")
                  .map((p) => (
                    <option key={p.id}>{p.name}</option>
                  ))}
              </select>
            </label>
            <label className="form-field">
              Mentor
              <select value={mentor} onChange={(e) => setMentor(e.target.value)}>
                <option value="Semua">Semua</option>
                {m.people
                  .filter((p) => p.role === "Mentor")
                  .map((p) => (
                    <option key={p.id}>{p.name}</option>
                  ))}
              </select>
            </label>
          </div>
          <FormError text={error} />
          <div className="form-actions">
            <Button onClick={build}>
              <Download />
              Buat PDF
            </Button>
          </div>
        </div>
      </Panel>
      {preview && (
        <div className="mt-5">
          <Panel
            title={`Pratinjau isi PDF: ${preview.title}`}
            subtitle="InJourney Airports · Intern Management & Attendance System"
          >
            <SimpleTable head={preview.head} rows={preview.rows} empty="" />
          </Panel>
        </div>
      )}
    </>
  );
}

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

// ---------- Log Aktivitas (design-admin.md Alur 11) ----------

export function LogsPage() {
  const m = useMock();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [admin, setAdmin] = useState("Semua");
  const [action, setAction] = useState("Semua");
  const admins = [...new Set(m.logs.map((l) => l.admin))];
  const actions = [...new Set(m.logs.map((l) => l.action))];
  const list = m.logs
    .filter((l) => (!from || l.time.slice(0, 10) >= from) && (!to || l.time.slice(0, 10) <= to))
    .filter((l) => admin === "Semua" || l.admin === admin)
    .filter((l) => action === "Semua" || l.action === action)
    .sort((a, b) => b.time.localeCompare(a.time));
  return (
    <>
      <PageHeading
        title="Log Aktivitas"
        subtitle="Jejak tindakan admin. Hanya baca, tidak dapat diubah atau dihapus siapa pun."
      />
      <div className="toolbar">
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
        <div className="flex gap-2">
          <select
            className="role-select"
            aria-label="Filter admin"
            value={admin}
            onChange={(e) => setAdmin(e.target.value)}
          >
            <option value="Semua">Admin: Semua</option>
            {admins.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select
            className="role-select"
            aria-label="Filter jenis aksi"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="Semua">Jenis aksi: Semua</option>
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>
      <Panel title={`${list.length} catatan`}>
        <SimpleTable
          empty="Tidak ada aktivitas pada filter ini."
          head={["Waktu", "Admin", "Jenis", "Objek", "Detail"]}
          rows={list.map((l) => [
            formatShortTime(l.time),
            shortName(l.admin),
            l.action,
            l.object,
            <span key="d" className="whitespace-normal">
              {l.detail}
            </span>,
          ])}
        />
      </Panel>
    </>
  );
}
