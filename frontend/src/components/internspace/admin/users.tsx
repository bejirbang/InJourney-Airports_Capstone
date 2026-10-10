import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Copy, MoreHorizontal, Pencil, Plus, Search } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type Role,
  TODAY,
  deactivateBlock,
  formatDate,
  formatPeriod,
  formatRange,
  formatShort,
  formatShortTime,
  validateAccount,
} from "@/lib/mock-rules";
import { type PageSearch } from "@/lib/search";
import { ExtendDialog } from "@/components/internspace/admin/extend-dialog";
import { WarningList } from "@/components/internspace/admin/warnings";
import {
  ME,
  type Person,
  type Report,
  type Task,
  recap,
  useMock,
} from "@/components/internspace/shared/model";
import {
  Confirm,
  DetailList,
  Empty,
  FormError,
  MonthNav,
  PageHeading,
  Panel,
  SimpleTable,
  Status,
  Tabs,
  Tag,
} from "@/components/internspace/shared/ui";

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
