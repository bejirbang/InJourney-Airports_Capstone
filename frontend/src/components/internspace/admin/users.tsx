import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Copy, ExternalLink, MoreHorizontal, Pencil, Plus, Search } from "lucide-react";
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
  ACCOUNT_STATUS_LABEL,
  ASSESSMENT_STATUS_LABEL,
  ATTENDANCE_STATUS_LABEL,
  CORRECTION_STATUS_LABEL,
  INSTITUTION_TYPE_LABEL,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  LOGBOOK_STATUS_LABEL,
  PRESENTATION_STATUS_LABEL,
  labelOf,
} from "@/lib/labels";
import {
  formatDate,
  formatDateTime,
  formatPeriod,
  formatRange,
  formatShort,
  formatShortTime,
} from "@/lib/utils";
import { ApiError } from "@/lib/api";
import type {
  AdminAccountStatus,
  AdminAirport,
  AdminMentorOption,
  AdminRole,
  AdminUnit,
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
} from "@/lib/endpoints/admin";
import { type PageSearch } from "@/lib/search";
import { AirportFilter, useAirportFilter } from "@/components/internspace/admin/airport-filter";
import { ExtendDialog } from "@/components/internspace/admin/extend-dialog";
import { useExtendInternship } from "@/components/internspace/admin/dashboard-data";
import {
  useAdminUsers,
  useAdminMentors,
  useAdminUser,
  useAdminInternAttendance,
  useAdminInternDay,
  useAdminInternLeaves,
  useAdminInternLogbooks,
  useAdminInternCorrections,
  useChangeMentor,
  useCreateAdminUser,
  useMentorChangeImpact,
  useResetAdminPassword,
  useToggleAdminUser,
  useUpdateAdminUser,
} from "@/components/internspace/admin/users-data";
import { useAdminUnits } from "@/components/internspace/admin/settings-data";
import { useAdminWarnings, useSaveWarning } from "@/components/internspace/admin/warnings-data";
import { useAdminAssessment } from "@/components/internspace/admin/assessments-data";
import { useAdminAirports } from "@/components/internspace/admin/locations-data";
import {
  Confirm,
  DetailList,
  Empty,
  ErrorState,
  FormError,
  LoadingState,
  MonthNav,
  PageHeading,
  Panel,
  SimpleTable,
  Status,
  Tabs,
  Tag,
} from "@/components/internspace/shared/ui";
import { errorText, todayIso } from "@/components/internspace/admin/utils";

const ROLE_LABEL: Record<string, string> = {
  intern: "Intern",
  mentor: "Mentor",
  admin: "Admin",
};

type UserTab = "attendance" | "logbooks" | "leaves" | "corrections" | "warnings" | "final";

interface Actions {
  edit: (user: AdminUser) => void;
  changeMentor: (user: AdminUser) => void;
  extend: (user: AdminUser) => void;
  reset: (user: AdminUser) => void;
  deactivate: (user: AdminUser) => void;
  activate: (user: AdminUser) => void;
}

// ---------- Pengguna (design-admin.md Alur 2) ----------
export function UsersPage() {
  const search = useSearch({ strict: false }) as PageSearch;
  const navigate = useNavigate();
  const filter = useAirportFilter();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<AdminRole | "">("");
  const [status, setStatus] = useState<AdminAccountStatus | "all">("active");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<AdminUser | "new" | null>(null);
  const [temp, setTemp] = useState<{ name: string; password: string } | null>(null);
  const [mentorFor, setMentorFor] = useState<AdminUser | null>(null);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [deactivate, setDeactivate] = useState<AdminUser | null>(null);
  const [ending, setEnding] = useState<AdminUser | null>(null);
  const list = useAdminUsers({
    ...(query.trim() === "" ? {} : { q: query.trim() }),
    role,
    status,
    page,
    ...(filter.airportId === null ? {} : { airport_id: filter.airportId }),
  });
  const openId =
    search.open !== undefined && /^\d+$/.test(search.open) ? Number(search.open) : null;
  const toggle = useToggleAdminUser();
  const reset = useResetAdminPassword();
  const extend = useExtendInternship();

  const actions: Actions = {
    edit: (user) => setForm(user),
    changeMentor: (user) => setMentorFor(user),
    extend: (user) => setEnding(user),
    reset: (user) => setResetFor(user),
    deactivate: (user) => setDeactivate(user),
    activate: (user) =>
      toggle.mutate(
        { id: user.id, active: true },
        {
          onSuccess: (body) => toast.success(body.message),
          onError: (cause) => toast.error(errorText(cause, "Akun gagal diaktifkan.")),
        },
      ),
  };

  const dialogs = (
    <>
      <AccountForm
        target={form}
        onClose={() => setForm(null)}
        onCreated={(name, password) => setTemp({ name, password })}
      />
      <MentorDialog user={mentorFor} onClose={() => setMentorFor(null)} />
      <ExtendDialog
        intern={ending ? { id: ending.id, name: ending.name } : null}
        currentEnd={ending?.end_date ?? null}
        mutation={extend}
        onClose={() => setEnding(null)}
      />
      <Confirm
        open={resetFor !== null}
        title={`Reset password ${resetFor?.name ?? ""}?`}
        confirmLabel="Ya, reset"
        disabled={reset.isPending}
        onClose={() => setResetFor(null)}
        onConfirm={() => {
          if (resetFor === null) return;
          const user = resetFor;
          reset.mutate(user.id, {
            onSuccess: (password) => {
              setTemp({ name: user.name, password });
              setResetFor(null);
            },
            onError: (cause) => toast.error(errorText(cause, "Password gagal direset.")),
          });
        }}
      >
        Sistem membuat password sementara baru. Pengguna wajib menggantinya saat login berikutnya.
      </Confirm>
      <Confirm
        open={deactivate !== null}
        title={`Nonaktifkan akun ${deactivate?.name ?? ""}?`}
        confirmLabel="Nonaktifkan"
        destructive
        disabled={toggle.isPending}
        onClose={() => setDeactivate(null)}
        onConfirm={() => {
          if (deactivate === null) return;
          toggle.mutate(
            { id: deactivate.id, active: false },
            {
              onSuccess: (body) => toast.success(body.message),
              onError: (cause) => toast.error(errorText(cause, "Akun gagal dinonaktifkan.")),
            },
          );
          setDeactivate(null);
        }}
      >
        Akun tidak bisa login dan tidak muncul di daftar aktif. Data tetap bisa dilihat admin dan
        mentor.
      </Confirm>
      <TempPasswordDialog temp={temp} onClose={() => setTemp(null)} />
    </>
  );

  if (openId !== null) {
    return (
      <>
        <UserDetail
          id={openId}
          actions={actions}
          onBack={() => navigate({ to: "/users", search: { airport_id: search.airport_id ?? "" } })}
        />
        {dialogs}
      </>
    );
  }

  const rows = list.data?.rows ?? [];
  const meta = list.data?.meta;
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
        <AirportFilter
          value={filter.airportId}
          onChange={(airportId) => {
            filter.setAirport(airportId);
            setPage(1);
          }}
          airports={filter.airports}
          disabled={filter.airportsLoading}
        />
        <label className="search-field">
          <Search size={15} className="text-muted-foreground" />
          <input
            aria-label="Cari pengguna"
            placeholder="Cari nama atau email"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          className="role-select"
          aria-label="Filter role"
          value={role}
          onChange={(event) => {
            setRole(event.target.value as AdminRole | "");
            setPage(1);
          }}
        >
          <option value="">Role: Semua</option>
          <option value="intern">Intern</option>
          <option value="mentor">Mentor</option>
          <option value="admin">Admin</option>
        </select>
        <select
          className="role-select"
          aria-label="Filter status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as AdminAccountStatus | "all");
            setPage(1);
          }}
        >
          <option value="active">Status: Aktif</option>
          <option value="inactive">Status: Nonaktif</option>
          <option value="all">Status: Semua</option>
        </select>
      </div>
      <Panel
        title="Daftar pengguna"
        subtitle={
          meta
            ? `Menampilkan ${rows.length === 0 ? 0 : (meta.current_page - 1) * meta.per_page + 1}-${
                (meta.current_page - 1) * meta.per_page + rows.length
              } dari ${meta.total}`
            : undefined
        }
      >
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : rows.length === 0 ? (
          <Empty>Tidak ada pengguna yang sesuai filter.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Role</th>
                  <th>Unit</th>
                  <th>Lokasi / Mentor</th>
                  <th>Periode magang</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Link
                        to="/users"
                        search={{ open: String(user.id) }}
                        className="font-semibold hover:underline"
                      >
                        {user.name}
                      </Link>
                      <small className="block text-muted-foreground">{user.email}</small>
                    </td>
                    <td>{labelOf(ROLE_LABEL, user.role)}</td>
                    <td>{user.unit?.name ?? "-"}</td>
                    <td>
                      {user.role === "intern"
                        ? `${user.airport?.name ?? "-"} / ${user.mentor?.name ?? "-"}`
                        : "-"}
                    </td>
                    <td>
                      {user.role === "intern" && user.start_date && user.end_date
                        ? formatPeriod(user.start_date, user.end_date)
                        : "-"}
                    </td>
                    <td>
                      <Status status={labelOf(ACCOUNT_STATUS_LABEL, user.status)} />
                    </td>
                    <td>
                      <RowActions user={user} actions={actions} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.last_page > 1 && (
          <div className="flex flex-wrap justify-end gap-1 p-4">
            <Button
              size="sm"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Sebelumnya
            </Button>
            <span className="px-2 py-1 text-sm">
              Halaman {meta.current_page} dari {meta.last_page}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= meta.last_page}
              onClick={() => setPage((value) => value + 1)}
            >
              Berikutnya
            </Button>
          </div>
        )}
      </Panel>
      {dialogs}
    </>
  );
}

function RowActions({ user, actions }: { user: AdminUser; actions: Actions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={`Aksi untuk ${user.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to="/users" search={{ open: String(user.id) }}>
            Lihat detail
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.edit(user)}>Ubah data</DropdownMenuItem>
        {user.role === "intern" && (
          <DropdownMenuItem onSelect={() => actions.changeMentor(user)}>
            Ganti mentor
          </DropdownMenuItem>
        )}
        {user.role === "intern" && (
          <DropdownMenuItem onSelect={() => actions.extend(user)}>
            Perpanjang magang
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => actions.reset(user)}>Reset password</DropdownMenuItem>
        <DropdownMenuSeparator />
        {user.is_active === false ? (
          <DropdownMenuItem onSelect={() => actions.activate(user)}>Aktifkan</DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="text-destructive" onSelect={() => actions.deactivate(user)}>
            Nonaktifkan
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountForm({
  target,
  onClose,
  onCreated,
}: {
  target: AdminUser | "new" | null;
  onClose: () => void;
  onCreated: (name: string, password: string) => void;
}) {
  const editing = target && target !== "new" ? target : null;
  const create = useCreateAdminUser();
  const update = useUpdateAdminUser();
  const units = useAdminUnits();
  const mentors = useAdminMentors();
  const airports = useAdminAirports();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("intern");
  const [unitId, setUnitId] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [airportId, setAirportId] = useState("");
  const [institutionType, setInstitutionType] = useState<"universitas" | "sekolah">("universitas");
  const [university, setUniversity] = useState("");
  const [major, setMajor] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(editing?.name ?? "");
    setEmail(editing?.email ?? "");
    setRole(editing?.role ?? "intern");
    setUnitId(editing?.unit ? String(editing.unit.id) : "");
    setMentorId(editing?.mentor ? String(editing.mentor.id) : "");
    setAirportId(editing?.airport ? String(editing.airport.id) : "");
    setInstitutionType(editing?.institution_type ?? "universitas");
    setUniversity(editing?.university ?? "");
    setMajor(editing?.major ?? "");
    setStudentNumber(editing?.student_number ?? "");
    setStartDate(editing?.start_date ?? "");
    setEndDate(editing?.end_date ?? "");
    setError(null);
  }, [target, editing]);

  const isIntern = role === "intern";
  const needsUnit = role === "intern" || role === "mentor";
  const pending = create.isPending || update.isPending;

  const submit = () => {
    setError(null);
    if (name.trim() === "") return setError("Nama wajib diisi.");
    if (email.trim() === "") return setError("Email wajib diisi.");
    if (needsUnit && unitId === "") return setError("Unit wajib diisi.");
    if (isIntern && !editing) {
      if (mentorId === "") return setError("Pilih mentor untuk intern ini.");
      if (airportId === "") return setError("Pilih lokasi magang.");
      if (university.trim() === "") return setError("Asal universitas/sekolah wajib diisi.");
      if (major.trim() === "") return setError("Jurusan wajib diisi.");
      if (studentNumber.trim() === "") return setError("NIM/NIS wajib diisi.");
      if (startDate === "" || endDate === "") return setError("Isi tanggal mulai dan selesai.");
    }

    const onError = (cause: unknown) => setError(errorText(cause, "Akun gagal disimpan."));

    if (editing) {
      const input: AdminUserUpdateInput = {
        name: name.trim(),
        email: email.trim(),
        ...(needsUnit ? { unit_id: Number(unitId) } : {}),
        ...(isIntern
          ? {
              airport_id: Number(airportId),
              institution_type: institutionType,
              university: university.trim(),
              major: major.trim(),
              student_number: studentNumber.trim(),
              start_date: startDate,
              end_date: endDate,
            }
          : {}),
      };
      update.mutate(
        { id: editing.id, input },
        {
          onSuccess: onClose,
          onError,
        },
      );
      return;
    }

    const input: AdminUserCreateInput = {
      name: name.trim(),
      email: email.trim(),
      role,
      ...(needsUnit ? { unit_id: Number(unitId) } : {}),
      ...(isIntern
        ? {
            mentor_id: Number(mentorId),
            airport_id: Number(airportId),
            institution_type: institutionType,
            university: university.trim(),
            major: major.trim(),
            student_number: studentNumber.trim(),
            start_date: startDate,
            end_date: endDate,
          }
        : {}),
    };
    create.mutate(input, {
      onSuccess: (body) => {
        onCreated(body.data.name, body.temporary_password);
        onClose();
      },
      onError,
    });
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogTitle>{editing ? `Ubah data - ${editing.name}` : "Tambah Akun"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Role tidak bisa diubah. Mentor diubah lewat Ganti mentor."
            : "Password sementara dibuat otomatis oleh sistem dan hanya tampil sekali."}
        </DialogDescription>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="form-field">
            Nama lengkap *
            <input value={name} maxLength={255} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="form-field">
            Email internal *
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <fieldset className="form-field">
            <legend className="mb-2">Role *</legend>
            <div className="flex gap-5">
              {(["intern", "mentor", "admin"] as const).map((value) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={role === value}
                    disabled={!!editing}
                    onChange={() => setRole(value)}
                  />
                  {labelOf(ROLE_LABEL, value)}
                </label>
              ))}
            </div>
          </fieldset>
          {needsUnit && (
            <label className="form-field">
              Unit *
              <select value={unitId} onChange={(event) => setUnitId(event.target.value)}>
                <option value="">Pilih unit</option>
                {(units.data ?? [])
                  .filter((unit: AdminUnit) => unit.is_active || String(unit.id) === unitId)
                  .map((unit: AdminUnit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {isIntern && !editing && (
            <>
              <label className="form-field">
                Mentor *
                <select value={mentorId} onChange={(event) => setMentorId(event.target.value)}>
                  <option value="">Pilih mentor</option>
                  {(mentors.data ?? []).map((mentor: AdminMentorOption) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.name}
                      {mentor.unit ? ` - ${mentor.unit.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Lokasi magang *
                <select value={airportId} onChange={(event) => setAirportId(event.target.value)}>
                  <option value="">Pilih bandara</option>
                  {(airports.data ?? []).map((airport: AdminAirport) => (
                    <option key={airport.id} value={airport.id}>
                      {airport.name}
                      {airport.is_active ? "" : " (nonaktif)"}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {isIntern && (
            <>
              <fieldset className="form-field">
                <legend className="mb-2">Jenis institusi *</legend>
                <div className="flex gap-5">
                  {(["universitas", "sekolah"] as const).map((value) => (
                    <label key={value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={institutionType === value}
                        onChange={() => setInstitutionType(value)}
                      />
                      {labelOf(INSTITUTION_TYPE_LABEL, value)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="form-field">
                {institutionType === "universitas" ? "Asal Universitas *" : "Asal Sekolah *"}
                <input value={university} onChange={(event) => setUniversity(event.target.value)} />
              </label>
              <label className="form-field">
                Jurusan *
                <input value={major} onChange={(event) => setMajor(event.target.value)} />
              </label>
              <label className="form-field">
                {institutionType === "universitas" ? "NIM *" : "NIS *"}
                <input
                  value={studentNumber}
                  maxLength={30}
                  onChange={(event) => setStudentNumber(event.target.value)}
                />
              </label>
              <div className="form-two">
                <label className="form-field">
                  Tanggal mulai *
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </label>
                <label className="form-field">
                  Tanggal selesai *
                  <input
                    type="date"
                    min={startDate || undefined}
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </label>
              </div>
            </>
          )}
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MentorDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const impact = useMentorChangeImpact(user?.id ?? null);
  const mentors = useAdminMentors();
  const change = useChangeMentor();
  const [mentor, setMentor] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMentor("");
    setError(null);
  }, [user?.id]);

  if (user === null) return null;
  const current = impact.data?.current_mentor ?? user.mentor;
  const options = (mentors.data ?? []).filter((option) => option.id !== current?.id);

  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Ganti Mentor - {user.name}</DialogTitle>
        <DialogDescription>
          Mentor saat ini: {current?.name ?? "-"}. Satu intern tepat satu mentor.
        </DialogDescription>
        <div className="banner muted flex-col !items-start">
          <strong>Yang akan dipindahkan ke mentor baru:</strong>
          {impact.isLoading ? (
            <span>Memuat dampak...</span>
          ) : impact.isError ? (
            <span>{errorText(impact.error, "Dampak pergantian mentor gagal dimuat.")}</span>
          ) : (
            <>
              <span>- {impact.data?.pending_corrections ?? 0} koreksi menunggu mentor</span>
              <span>- {impact.data?.pending_leaves ?? 0} izin menunggu</span>
            </>
          )}
          <span>Riwayat keputusan lama tetap tersimpan.</span>
        </div>
        <label className="form-field">
          Mentor baru *
          <select value={mentor} onChange={(event) => setMentor(event.target.value)}>
            <option value="">Pilih mentor</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <FormError text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={change.isPending}
            onClick={() => {
              if (mentor === "") return setError("Pilih mentor baru.");
              change.mutate(
                { id: user.id, mentorId: Number(mentor) },
                {
                  onSuccess: (body) => {
                    toast.success(body.message);
                    onClose();
                  },
                  onError: (cause) => setError(errorText(cause, "Mentor gagal diganti.")),
                },
              );
            }}
          >
            {change.isPending ? "Memindahkan..." : "Pindahkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TempPasswordDialog({
  temp,
  onClose,
}: {
  temp: { name: string; password: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={temp !== null} onOpenChange={() => undefined}>
      <DialogContent className="max-w-md" onInteractOutside={(event) => event.preventDefault()}>
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
            <Copy /> Salin
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Sampaikan email internal dan password ini ke pengguna. Pengguna wajib mengganti password
          saat login pertama.
        </p>
        <DialogFooter>
          <Button onClick={onClose}>Sudah disalin, tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserDetail({ id, actions, onBack }: { id: number; actions: Actions; onBack: () => void }) {
  const search = useSearch({ strict: false }) as PageSearch;
  const user = useAdminUser(id);
  const [tab, setTab] = useState<UserTab>(() => {
    const value = search.tab;
    return value === "logbooks" ||
      value === "leaves" ||
      value === "corrections" ||
      value === "warnings" ||
      value === "final"
      ? value
      : "attendance";
  });

  if (user.isLoading) return <LoadingState />;
  if (user.isError) return <ErrorState error={user.error} onRetry={() => void user.refetch()} />;
  const person = user.data;
  if (!person) return null;
  const isIntern = person.role === "intern";

  return (
    <>
      <div className="page-heading">
        <div>
          <Button variant="link" className="mb-2 h-auto p-0" onClick={onBack}>
            <ArrowLeft /> Pengguna
          </Button>
          <h1>{person.name}</h1>
          <p className="flex flex-wrap items-center gap-3">
            <Status status={labelOf(ACCOUNT_STATUS_LABEL, person.status)} />
            <span>{labelOf(ROLE_LABEL, person.role)}</span>
            {person.unit && <span>Unit: {person.unit.name}</span>}
            {isIntern && <span>Lokasi: {person.airport?.name ?? "-"}</span>}
            {isIntern && <span>Mentor: {person.mentor?.name ?? "-"}</span>}
            {isIntern && person.start_date && person.end_date && (
              <span>Periode: {formatPeriod(person.start_date, person.end_date)}</span>
            )}
            {isIntern && person.leave_quota && (
              <span>
                Kuota izin: {person.leave_quota.used} dari {person.leave_quota.limit}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => actions.edit(person)}>
            <Pencil /> Ubah
          </Button>
          <RowActions user={person} actions={actions} />
        </div>
      </div>

      {isIntern ? (
        <Tabs
          label="Detail pengguna"
          value={tab}
          onChange={setTab}
          items={[
            { value: "attendance", label: "Presensi" },
            { value: "logbooks", label: "Logbook" },
            { value: "leaves", label: "Izin" },
            { value: "corrections", label: "Koreksi" },
            { value: "warnings", label: "Warning" },
            { value: "final", label: "Akhir Magang" },
          ]}
        />
      ) : (
        <Panel title="Profil">
          <div className="px-5 pb-5">
            <DetailList
              items={[
                ["Email internal", person.email],
                ["Role", labelOf(ROLE_LABEL, person.role)],
                ["Unit", person.unit?.name ?? "-"],
                ["Telepon", person.phone ?? "-"],
                ["Dibuat", person.created_at ? formatDateTime(person.created_at) : "-"],
                ...(person.role === "mentor"
                  ? [
                      [
                        "Intern bimbingan",
                        (person.interns ?? []).map((intern) => intern.name).join(", ") || "-",
                      ] as [string, string],
                    ]
                  : []),
              ]}
            />
          </div>
        </Panel>
      )}

      {isIntern && tab === "attendance" && <AttendanceTab user={person} />}
      {isIntern && tab === "logbooks" && <LogbookTab user={person} />}
      {isIntern && tab === "leaves" && <LeavesTab user={person} />}
      {isIntern && tab === "corrections" && <CorrectionsTab user={person} />}
      {isIntern && tab === "warnings" && <WarningsTab user={person} />}
      {isIntern && tab === "final" && <FinalTab user={person} />}
    </>
  );
}

function AttendanceTab({ user }: { user: AdminUser }) {
  const [month, setMonth] = useState(user.start_date?.slice(0, 7) ?? todayIso().slice(0, 7));
  const [date, setDate] = useState<string | null>(null);
  const data = useAdminInternAttendance(user.id, month);
  const day = useAdminInternDay(user.id, date);
  const recap = data.data?.recap;

  return (
    <>
      <Panel
        title="Presensi"
        action={
          data.data?.selectable_months ? (
            <MonthNav
              value={month}
              onChange={setMonth}
              min={data.data.selectable_months.first}
              max={data.data.selectable_months.last}
            />
          ) : undefined
        }
      >
        {data.isLoading ? (
          <LoadingState />
        ) : data.isError ? (
          <ErrorState error={data.error} onRetry={() => void data.refetch()} />
        ) : (
          <>
            {recap && (
              <div className="recap-strip">
                <span>
                  Hadir <strong>{recap.present}</strong>
                </span>
                <span>
                  Terlambat <strong>{recap.late}</strong>
                </span>
                <span>
                  Lupa Clock In <strong>{recap.missed_clock_in}</strong>
                </span>
                <span>
                  Izin <strong>{recap.leave}</strong>
                </span>
                <span>
                  Tidak Hadir <strong>{recap.absent}</strong>
                </span>
                <span>
                  Lupa Clock Out <strong>{recap.missed_clock_out}</strong>
                </span>
                <span>
                  Hari kerja <strong>{recap.working_days}</strong>
                </span>
              </div>
            )}
            {(data.data?.days ?? []).length === 0 ? (
              <Empty>Belum ada data presensi pada bulan ini.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                      <th>Status</th>
                      <th>Logbook</th>
                      <th>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.data?.days ?? []).map((row) => (
                      <tr key={row.date}>
                        <td>{formatDate(row.date)}</td>
                        <td>{row.clock_in_at ? formatShortTime(row.clock_in_at) : "-"}</td>
                        <td>{row.clock_out_at ? formatShortTime(row.clock_out_at) : "-"}</td>
                        <td>
                          <span className="flex flex-wrap gap-2">
                            <Status status={labelOf(ATTENDANCE_STATUS_LABEL, row.status)} />
                            {row.missed_clock_out && <Tag>Lupa Clock Out</Tag>}
                            {row.is_corrected && <Tag>Dikoreksi</Tag>}
                            {row.has_active_correction && <Tag>Koreksi aktif</Tag>}
                          </span>
                        </td>
                        <td className="max-w-xs truncate">
                          {row.logbook_work ??
                            (row.logbook_state
                              ? labelOf(LOGBOOK_STATUS_LABEL, row.logbook_state)
                              : "-")}
                        </td>
                        <td>
                          <Button size="sm" variant="outline" onClick={() => setDate(row.date)}>
                            Buka
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Panel>
      <Dialog open={date !== null} onOpenChange={(open) => !open && setDate(null)}>
        <DialogContent>
          <DialogTitle>Presensi {date ? formatDate(date) : ""}</DialogTitle>
          <DialogDescription>Data presensi dari server.</DialogDescription>
          {day.isLoading ? (
            <LoadingState />
          ) : day.isError ? (
            <ErrorState error={day.error} onRetry={() => void day.refetch()} />
          ) : day.data ? (
            <DetailList
              items={[
                ["Status", labelOf(ATTENDANCE_STATUS_LABEL, day.data.status)],
                ["Clock in", day.data.clock_in_at ? formatShortTime(day.data.clock_in_at) : "-"],
                ["Clock out", day.data.clock_out_at ? formatShortTime(day.data.clock_out_at) : "-"],
                ["Terlambat", day.data.late_minutes ? `${day.data.late_minutes} menit` : "-"],
                [
                  "Jadwal",
                  day.data.scheduled
                    ? `${day.data.scheduled.start}–${day.data.scheduled.end}`
                    : "-",
                ],
                ["Kantor clock in", day.data.clock_in_office?.name ?? "-"],
                ["Kantor clock out", day.data.clock_out_office?.name ?? "-"],
                ["Logbook", day.data.logbook?.work ?? "-"],
                ["Catatan logbook", day.data.logbook?.notes ?? "-"],
              ]}
            />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDate(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LogbookTab({ user }: { user: AdminUser }) {
  const [month, setMonth] = useState(user.start_date?.slice(0, 7) ?? todayIso().slice(0, 7));
  const data = useAdminInternLogbooks(user.id, month);
  return (
    <Panel
      title="Logbook"
      subtitle="Hanya baca. Review adalah hak mentor."
      action={
        data.data?.selectable_months ? (
          <MonthNav
            value={month}
            onChange={setMonth}
            min={data.data.selectable_months.first}
            max={data.data.selectable_months.last}
          />
        ) : undefined
      }
    >
      {data.isLoading ? (
        <LoadingState />
      ) : data.isError ? (
        <ErrorState error={data.error} onRetry={() => void data.refetch()} />
      ) : (data.data?.days ?? []).length === 0 ? (
        <Empty>Belum ada logbook pada bulan ini.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Status</th>
                <th>Pekerjaan</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {(data.data?.days ?? []).map((row) => (
                <tr key={row.date}>
                  <td>{formatDate(row.date)}</td>
                  <td>
                    <Status
                      status={labelOf(
                        LOGBOOK_STATUS_LABEL,
                        row.logbook_state ?? row.logbook?.status ?? "missing",
                      )}
                    />
                  </td>
                  <td className="max-w-md">{row.logbook?.work ?? "-"}</td>
                  <td className="max-w-sm">{row.logbook?.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function LeavesTab({ user }: { user: AdminUser }) {
  const data = useAdminInternLeaves(user.id);
  return (
    <Panel title="Izin">
      {data.isLoading ? (
        <LoadingState />
      ) : data.isError ? (
        <ErrorState error={data.error} onRetry={() => void data.refetch()} />
      ) : (
        <SimpleTable
          empty="Belum ada pengajuan izin."
          head={["Jenis", "Tanggal", "Hari kerja", "Status", "Diproses oleh", "Catatan"]}
          rows={(data.data ?? []).map((row) => [
            labelOf(LEAVE_TYPE_LABEL, row.type),
            formatRange(row.start_date, row.end_date),
            String(row.working_days),
            <Status key="status" status={labelOf(LEAVE_STATUS_LABEL, row.status)} />,
            row.decided_by?.name ?? "-",
            row.decision_note ?? "-",
          ])}
        />
      )}
    </Panel>
  );
}

function CorrectionsTab({ user }: { user: AdminUser }) {
  const data = useAdminInternCorrections(user.id);
  return (
    <Panel title="Koreksi">
      {data.isLoading ? (
        <LoadingState />
      ) : data.isError ? (
        <ErrorState error={data.error} onRetry={() => void data.refetch()} />
      ) : (
        <SimpleTable
          empty="Belum ada permintaan koreksi."
          head={["Tanggal presensi", "Diajukan", "Status", "Mentor", "Catatan admin"]}
          rows={(data.data ?? []).map((row) => [
            formatShort(row.date, true),
            row.submitted_at ? formatDateTime(row.submitted_at) : "-",
            <Status key="status" status={labelOf(CORRECTION_STATUS_LABEL, row.status)} />,
            row.mentor ?? "-",
            row.admin_note ?? "-",
          ])}
        />
      )}
    </Panel>
  );
}

function WarningsTab({ user }: { user: AdminUser }) {
  const data = useAdminWarnings(user.id);
  const save = useSaveWarning();
  const [body, setBody] = useState("");
  const [editId, setEditId] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);

  return (
    <Panel
      title="Warning"
      subtitle={
        data.data
          ? `Terlambat bulan ini: ${data.data.late_this_month} · Kuota izin: ${
              data.data.leave_quota
                ? `${data.data.leave_quota.used} dari ${data.data.leave_quota.limit}`
                : "-"
            }`
          : undefined
      }
    >
      {data.isLoading ? (
        <LoadingState />
      ) : data.isError ? (
        <ErrorState error={data.error} onRetry={() => void data.refetch()} />
      ) : (
        <div className="grid gap-4 p-5">
          {(data.data?.warnings ?? []).length === 0 ? (
            <Empty>Belum ada catatan.</Empty>
          ) : (
            (data.data?.warnings ?? []).map((warning) => (
              <div className="rounded-lg border p-4" key={warning.id}>
                <p className="whitespace-pre-wrap">{warning.body}</p>
                <small className="text-muted-foreground">
                  {warning.author?.name ?? "-"} ·{" "}
                  {warning.created_at ? formatDateTime(warning.created_at) : "-"}
                </small>
                {warning.can_edit && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditId(warning.id);
                        setBody(warning.body);
                      }}
                    >
                      Ubah
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
          <label className="grid gap-1 text-sm">
            {editId === undefined ? "Tambah catatan" : "Ubah catatan"}
            <textarea
              className="min-h-24 rounded-md border px-3 py-2"
              maxLength={2000}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setError(null);
              }}
            />
          </label>
          <FormError text={error} />
          <div className="flex gap-2">
            <Button
              disabled={save.isPending}
              onClick={() => {
                if (body.trim() === "") return setError("Catatan wajib diisi.");
                save.mutate(
                  { internId: user.id, warningId: editId, body: body.trim() },
                  {
                    onSuccess: (body) => {
                      toast.success(body.message);
                      setBody("");
                      setEditId(undefined);
                    },
                    onError: (cause) => setError(errorText(cause, "Catatan gagal disimpan.")),
                  },
                );
              }}
            >
              {save.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
            {editId !== undefined && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditId(undefined);
                  setBody("");
                  setError(null);
                }}
              >
                Batal
              </Button>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function FinalTab({ user }: { user: AdminUser }) {
  const data = useAdminAssessment(user.id);
  if (data.isLoading) return <LoadingState />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => void data.refetch()} />;
  const detail = data.data;
  if (!detail) return null;
  const presentation = detail.presentation;
  return (
    <>
      <Panel title="Presentasi Akhir">
        {presentation === null ? (
          <Empty>Belum ada presentasi akhir.</Empty>
        ) : (
          <div className="px-5 pb-5">
            <DetailList
              items={[
                [
                  "Status",
                  labelOf(
                    PRESENTATION_STATUS_LABEL,
                    detail.presentation_status ?? presentation.status,
                  ),
                ],
                [
                  "Dikirim",
                  presentation.submitted_at ? formatDateTime(presentation.submitted_at) : "-",
                ],
                ["Catatan keputusan", presentation.decision_note ?? "-"],
                ["Diputuskan oleh", presentation.decided_by ?? "-"],
              ]}
            />
            <a
              className="text-action mt-3 inline-flex items-center gap-1"
              href={presentation.evidence_url}
              target="_blank"
              rel="noreferrer"
            >
              Buka tautan presentasi <ExternalLink size={12} />
            </a>
          </div>
        )}
      </Panel>
      <Panel title="Penilaian Akhir">
        <div className="grid gap-4 p-5">
          <DetailList
            items={[
              ["Status", labelOf(ASSESSMENT_STATUS_LABEL, detail.status)],
              ["Nilai akhir", detail.final_score === null ? "-" : String(detail.final_score)],
              ["Predikat", detail.predicate ?? "-"],
              ["Dinilai oleh", detail.assessed_by ?? "-"],
              ["Disubmit", detail.submitted_at ? formatDateTime(detail.submitted_at) : "-"],
              ["Catatan", detail.notes ?? "-"],
            ]}
          />
          {detail.blockers.length > 0 && (
            <div className="banner warn flex-col !items-start">
              {detail.blockers.map((blocker) => (
                <span key={blocker.code}>{blocker.text}</span>
              ))}
            </div>
          )}
          {detail.indicators.length === 0 ? (
            <Empty>Belum ada indikator penilaian.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Indikator</th>
                    <th>Kategori</th>
                    <th>Bobot</th>
                    <th>Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.indicators.map((indicator) => (
                    <tr key={indicator.id}>
                      <td>{indicator.name}</td>
                      <td>{indicator.category ?? "-"}</td>
                      <td>{indicator.weight ?? "-"}</td>
                      <td>{indicator.score ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
