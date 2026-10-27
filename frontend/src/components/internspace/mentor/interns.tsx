import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import {
  ASSESSMENT_STATUS_LABEL,
  ATTENDANCE_STATUS_LABEL,
  CORRECTION_STATUS_LABEL,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  LOGBOOK_STATUS_LABEL,
  PRESENTATION_STATUS_LABEL,
  labelOf,
} from "@/lib/labels";
import { TODAY, formatDate, formatDateTime, formatPeriod, formatRange } from "@/lib/mock-rules";
import type {
  MentorAssessmentDetail,
  MentorInternFilter,
  MentorInternLogbookDay,
  MentorInternRow,
} from "@/lib/endpoints/mentor";
import { type PageSearch } from "@/lib/search";
import { ApiDayDetail, ApiRecapStrip } from "@/components/internspace/shared/attendance-parts";
import {
  Empty,
  ErrorState,
  LoadingState,
  MonthNav,
  PageHeading,
  Panel,
  Status,
  Tabs,
  Tag,
} from "@/components/internspace/shared/ui";
import { useMentorAssessmentDetail } from "@/components/internspace/mentor/assessments-data";
import {
  useMentorAttendanceDay,
  useMentorInternAttendance,
  useMentorInternCorrections,
  useMentorInternDetail,
  useMentorInternLeaves,
  useMentorInternLogbooks,
  useMentorInterns,
  useMentorInternWarnings,
} from "@/components/internspace/mentor/interns-data";

// ---------- Intern Saya (design-mentor.md Alur 3) ----------

type DetailTab = "presensi" | "logbook" | "izin" | "koreksi" | "catatan" | "akhir";

const FILTERS: { value: MentorInternFilter; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
  { value: "former", label: "Pernah dibimbing" },
  { value: "all", label: "Semua" },
];

const TAB_VALUES: DetailTab[] = ["presensi", "logbook", "izin", "koreksi", "catatan", "akhir"];

const tabFromSearch = (tab: string | undefined): DetailTab =>
  TAB_VALUES.includes(tab as DetailTab) ? (tab as DetailTab) : "presensi";

const errorMessage = (error: unknown, fallback: string | undefined = undefined) =>
  error instanceof ApiError ? error.message : fallback;

function TodayCell({ row }: { row: MentorInternRow }) {
  if (row.relation === "former") return <Tag tone="light">Pernah dibimbing</Tag>;
  if (!row.is_active) return <Status status="Nonaktif" />;
  if (row.today_state === null) return <>-</>;
  return <Status status={labelOf(ATTENDANCE_STATUS_LABEL, row.today_state, row.today_state)} />;
}

export function MyInternsPage() {
  const search = useSearch({ strict: false }) as PageSearch;
  const selectedId = search.open ?? null;
  const [filter, setFilter] = useState<MentorInternFilter>("active");
  const [query, setQuery] = useState("");

  if (selectedId !== null && Number.isInteger(Number(selectedId))) {
    return <InternDetail id={selectedId} tabFromUrl={tabFromSearch(search.tab)} />;
  }

  return (
    <>
      <PageHeading
        title="Intern Saya"
        subtitle="Presensi, logbook, izin, koreksi, catatan, dan status akhir magang hanya dapat dilihat. Perubahan data intern dikelola admin."
      />
      <InternList filter={filter} query={query} onFilter={setFilter} onQuery={setQuery} />
    </>
  );
}

function InternList({
  filter,
  query,
  onFilter,
  onQuery,
}: {
  filter: MentorInternFilter;
  query: string;
  onFilter: (filter: MentorInternFilter) => void;
  onQuery: (query: string) => void;
}) {
  const list = useMentorInterns(filter, query);

  return (
    <>
      <div className="toolbar">
        <label className="search-field">
          <Search size={15} className="text-muted-foreground" />
          <input
            aria-label="Cari intern"
            placeholder="Cari intern"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>
        <select
          className="role-select"
          aria-label="Filter status"
          value={filter}
          onChange={(event) => onFilter(event.target.value as MentorInternFilter)}
        >
          {FILTERS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <Panel title={list.data ? `${list.data.interns.length} intern` : "Intern"}>
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <div className="px-5 pb-5">
            <ErrorState
              message={errorMessage(list.error, undefined)}
              onRetry={() => void list.refetch()}
            />
          </div>
        ) : list.data && list.data.interns.length === 0 ? (
          <Empty>
            {query
              ? "Tidak ada intern yang cocok dengan pencarian."
              : filter === "former"
                ? "Belum ada peserta yang pernah dibimbing."
                : "Belum ada intern bimbingan. Hubungi admin untuk penugasan."}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Universitas / Institusi</th>
                  <th>Lokasi</th>
                  <th>Hari ini</th>
                  <th>Periode magang</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(list.data?.interns ?? []).map((intern) => (
                  <tr key={intern.id}>
                    <td>
                      <strong>{intern.name}</strong>
                      {intern.student_number && (
                        <small className="block text-muted-foreground">
                          {intern.student_number}
                        </small>
                      )}
                    </td>
                    <td>
                      {intern.university ?? "-"}
                      {intern.major && (
                        <small className="block text-muted-foreground">{intern.major}</small>
                      )}
                    </td>
                    <td>{intern.airport ?? "-"}</td>
                    <td>
                      <TodayCell row={intern} />
                    </td>
                    <td>
                      {intern.start_date && intern.end_date
                        ? formatPeriod(intern.start_date, intern.end_date)
                        : "-"}
                      {intern.ends_in_days !== null &&
                        intern.ends_in_days >= 0 &&
                        intern.ends_in_days <= 7 &&
                        intern.is_active && (
                          <div className="text-[10px] text-warning font-semibold">
                            ! berakhir {intern.ends_in_days} hari lagi
                          </div>
                        )}
                    </td>
                    <td>
                      <Status status={intern.is_active ? "Aktif" : "Nonaktif"} />
                      {intern.relation === "former" && <Tag tone="light">Pernah dibimbing</Tag>}
                    </td>
                    <td>
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/intern-saya" search={{ open: String(intern.id) }}>
                          Buka
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function InternDetail({ id, tabFromUrl }: { id: string; tabFromUrl: DetailTab }) {
  const navigate = useNavigate();
  const detail = useMentorInternDetail(id);
  const [tab, setTab] = useState<DetailTab>(tabFromUrl);
  const [month, setMonth] = useState<string | null>(null);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [id, tabFromUrl]);

  if (detail.isLoading) {
    return (
      <Panel title="Intern">
        <LoadingState />
      </Panel>
    );
  }
  if (detail.isError) {
    return (
      <Panel title="Intern">
        <div className="px-5 pb-5">
          <ErrorState
            message={errorMessage(detail.error, undefined)}
            onRetry={() => void detail.refetch()}
          />
          <Button variant="link" onClick={() => void navigate({ to: "/intern-saya" })}>
            <ArrowLeft /> Kembali ke Intern Saya
          </Button>
        </div>
      </Panel>
    );
  }

  const data = detail.data;
  if (!data) return null;

  const bounds = data.selectable_months;
  const effectiveMonth =
    month !== null && bounds && month >= bounds.first && month <= bounds.last
      ? month
      : (bounds?.last ?? month ?? TODAY.slice(0, 7));
  const monthBounds = bounds ?? { first: effectiveMonth, last: effectiveMonth };
  const current = data.relation === "current";

  const changeTab = (next: DetailTab) => {
    setTab(next);
    void navigate({ to: "/intern-saya", search: { open: id, tab: next } });
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <Button
            variant="link"
            className="p-0 h-auto mb-2"
            onClick={() => void navigate({ to: "/intern-saya" })}
          >
            <ArrowLeft />
            Intern Saya
          </Button>
          <h1>{data.name}</h1>
          <p className="flex flex-wrap gap-3 items-center">
            <Status status={data.is_active ? "Aktif" : "Nonaktif"} />
            <span>
              Periode:{" "}
              {data.start_date && data.end_date
                ? formatPeriod(data.start_date, data.end_date)
                : "-"}
            </span>
            <span>{data.unit ?? "-"}</span>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void navigate({ to: "/chat", search: { to: data.name } })}
        >
          <MessageSquare />
          Chat dengan intern
        </Button>
      </div>

      {data.relation === "former" && (
        <div className="banner muted mb-4">
          Intern ini sekarang dibimbing {data.current_mentor?.name ?? "mentor lain"}. Anda hanya
          dapat melihat riwayat.
        </div>
      )}
      {!data.is_active && data.relation === "current" && (
        <div className="banner muted mb-4">
          Intern ini sudah nonaktif. Data hanya dapat dilihat.
        </div>
      )}
      {data.ends_in_days !== null &&
        data.ends_in_days >= 0 &&
        data.ends_in_days <= 7 &&
        data.is_active && (
          <div className="banner warn mb-4">
            Masa magang berakhir {data.ends_in_days} hari lagi.
          </div>
        )}

      <div className="info-line mb-4">
        <span>Lokasi: {data.airport ?? "-"}</span>
        <span>
          Institusi: {data.university ?? "-"}
          {data.major ? ` - ${data.major}` : ""}
        </span>
        {data.student_number && <span>NIM/NIS: {data.student_number}</span>}
        <span>
          Sisa kuota izin: {data.leave_quota.remaining} dari {data.leave_quota.limit}
        </span>
        <span>Mentor: {data.current_mentor?.name ?? "-"}</span>
      </div>

      <Tabs
        label="Detail intern"
        value={tab}
        onChange={changeTab}
        items={[
          { value: "presensi", label: "Presensi" },
          { value: "logbook", label: "Logbook" },
          { value: "izin", label: "Izin" },
          { value: "koreksi", label: "Koreksi" },
          { value: "catatan", label: "Catatan" },
          { value: "akhir", label: "Akhir Magang" },
        ]}
      />

      {tab === "presensi" && (
        <PresensiTab id={id} month={effectiveMonth} bounds={monthBounds} onMonth={setMonth} />
      )}
      {tab === "logbook" && (
        <LogbookTab id={id} month={effectiveMonth} bounds={monthBounds} onMonth={setMonth} />
      )}
      {tab === "izin" && <IzinTab id={id} canOpen={current} />}
      {tab === "koreksi" && <KoreksiTab id={id} canOpen={current} />}
      {tab === "catatan" && <CatatanTab id={id} />}
      {tab === "akhir" && <AkhirTab id={id} />}
    </>
  );
}

function PresensiTab({
  id,
  month,
  bounds,
  onMonth,
}: {
  id: string;
  month: string;
  bounds: { first: string; last: string };
  onMonth: (month: string) => void;
}) {
  const attendance = useMentorInternAttendance(id, month);
  const [date, setDate] = useState<string | null>(null);
  const day = useMentorAttendanceDay(id, date);
  const rows = (attendance.data?.days ?? []).filter((row) => row.status !== "holiday");

  return (
    <Panel
      title="Presensi"
      subtitle="Hanya baca. Perbaikan presensi lewat koreksi intern."
      action={
        <MonthNav
          value={attendance.data?.month ?? month}
          onChange={onMonth}
          min={bounds.first}
          max={bounds.last}
        />
      }
    >
      {attendance.isLoading ? (
        <LoadingState />
      ) : attendance.isError ? (
        <div className="px-5 pb-5">
          <ErrorState
            message={errorMessage(attendance.error, undefined)}
            onRetry={() => void attendance.refetch()}
          />
        </div>
      ) : (
        <>
          {attendance.data && <ApiRecapStrip recap={attendance.data.recap} />}
          {rows.length === 0 ? (
            <Empty>Belum ada data presensi pada bulan ini.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table clickable">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Masuk</th>
                    <th>Pulang</th>
                    <th>Status</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.date} onClick={() => setDate(row.date)}>
                      <td>{formatDate(row.date)}</td>
                      <td>{row.clock_in_at ?? "-"}</td>
                      <td>{row.clock_out_at ?? "-"}</td>
                      <td>
                        <Status status={labelOf(ATTENDANCE_STATUS_LABEL, row.status, row.status)} />
                      </td>
                      <td>
                        <span className="flex flex-wrap gap-2">
                          {row.is_corrected && <Tag>Dikoreksi</Tag>}
                          {row.missed_clock_out && <Tag tone="orange">Lupa Clock Out</Tag>}
                          {row.status === "late" && row.late_minutes !== null && (
                            <span>{row.late_minutes} menit</span>
                          )}
                          {row.leave_type && (
                            <Tag tone="blue">{labelOf(LEAVE_TYPE_LABEL, row.leave_type)}</Tag>
                          )}
                          {row.holiday_name && <span>{row.holiday_name}</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <ApiDayDetail
        date={date}
        day={day.data ?? null}
        loading={day.isLoading}
        error={day.isError ? (errorMessage(day.error, undefined) ?? null) : null}
        onRetry={() => void day.refetch()}
        onClose={() => setDate(null)}
      />
    </Panel>
  );
}

function LogbookTab({
  id,
  month,
  bounds,
  onMonth,
}: {
  id: string;
  month: string;
  bounds: { first: string; last: string };
  onMonth: (month: string) => void;
}) {
  const logbooks = useMentorInternLogbooks(id, month);
  const rows = (logbooks.data?.days ?? []).filter((day) => day.logbook !== null);

  return (
    <Panel
      title="Logbook"
      subtitle="Logbook yang sudah diisi intern."
      action={
        <MonthNav
          value={logbooks.data?.month ?? month}
          onChange={onMonth}
          min={bounds.first}
          max={bounds.last}
        />
      }
    >
      {logbooks.isLoading ? (
        <LoadingState />
      ) : logbooks.isError ? (
        <div className="px-5 pb-5">
          <ErrorState
            message={errorMessage(logbooks.error, undefined)}
            onRetry={() => void logbooks.refetch()}
          />
        </div>
      ) : rows.length === 0 ? (
        <Empty>Belum ada logbook pada bulan ini.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Ringkasan</th>
                <th>Status</th>
                <th>Dikirim</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((day) => (
                <LogbookRow key={day.date} day={day} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function LogbookRow({ day }: { day: MentorInternLogbookDay }) {
  const logbook = day.logbook;
  if (!logbook) return null;
  const reviewable = logbook.status === "pending_review" || logbook.status === "revision";

  return (
    <tr>
      <td>{formatDate(day.date)}</td>
      <td className="max-w-md truncate" title={logbook.work}>
        {logbook.work}
      </td>
      <td>
        <Status status={labelOf(LOGBOOK_STATUS_LABEL, logbook.status, logbook.status)} />
        {day.leave_type && <Tag tone="blue">{labelOf(LEAVE_TYPE_LABEL, day.leave_type)}</Tag>}
      </td>
      <td>{logbook.submitted_at ? formatDateTime(logbook.submitted_at) : "-"}</td>
      <td>
        {reviewable ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/logbook">Review</Link>
          </Button>
        ) : (
          "-"
        )}
      </td>
    </tr>
  );
}

function IzinTab({ id, canOpen }: { id: string; canOpen: boolean }) {
  const leaves = useMentorInternLeaves(id);
  const rows = leaves.data ?? [];

  return (
    <Panel
      title="Izin"
      subtitle={canOpen ? "Izin yang menunggu dapat diproses di halaman Izin." : "Hanya baca."}
    >
      {leaves.isLoading ? (
        <LoadingState />
      ) : leaves.isError ? (
        <div className="px-5 pb-5">
          <ErrorState
            message={errorMessage(leaves.error, undefined)}
            onRetry={() => void leaves.refetch()}
          />
        </div>
      ) : rows.length === 0 ? (
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
              {rows.map((leave) => (
                <tr key={leave.id}>
                  <td>{labelOf(LEAVE_TYPE_LABEL, leave.type)}</td>
                  <td>{formatRange(leave.start_date, leave.end_date)}</td>
                  <td>{leave.working_days}</td>
                  <td>
                    <Status status={labelOf(LEAVE_STATUS_LABEL, leave.status, leave.status)} />
                  </td>
                  <td>
                    {leave.decided_by
                      ? `${leave.decided_by.name} (${
                          leave.decided_by.role === "admin" ? "Admin" : "Mentor"
                        })`
                      : "-"}
                  </td>
                  <td>
                    {canOpen && leave.can_open ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/izin" search={{ open: String(leave.id) }}>
                          {leave.status === "pending" ? "Buka" : "Lihat"}
                        </Link>
                      </Button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function KoreksiTab({ id, canOpen }: { id: string; canOpen: boolean }) {
  const corrections = useMentorInternCorrections(id);
  const rows = corrections.data ?? [];

  return (
    <Panel title="Koreksi" subtitle="Mentor hanya memvalidasi; admin yang mengubah presensi.">
      {corrections.isLoading ? (
        <LoadingState />
      ) : corrections.isError ? (
        <div className="px-5 pb-5">
          <ErrorState
            message={errorMessage(corrections.error, undefined)}
            onRetry={() => void corrections.refetch()}
          />
        </div>
      ) : rows.length === 0 ? (
        <Empty>Belum ada pengajuan koreksi presensi.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Tercatat</th>
                <th>Alasan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.date)}</td>
                  <td>
                    <Status
                      status={labelOf(
                        ATTENDANCE_STATUS_LABEL,
                        row.recorded_status,
                        row.recorded_status,
                      )}
                    />
                    {row.recorded_missed_clock_out && <Tag tone="orange">Lupa Clock Out</Tag>}
                  </td>
                  <td className="max-w-md truncate" title={row.reason}>
                    {row.reason}
                  </td>
                  <td>
                    <Status status={labelOf(CORRECTION_STATUS_LABEL, row.status, row.status)} />
                  </td>
                  <td>
                    {canOpen ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/koreksi" search={{ open: String(row.id) }}>
                          {row.can_decide ? "Buka" : "Lihat"}
                        </Link>
                      </Button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function CatatanTab({ id }: { id: string }) {
  const warnings = useMentorInternWarnings(id);
  const rows = warnings.data ?? [];

  return (
    <Panel title="Catatan" subtitle="Catatan warning dari admin. Hanya baca.">
      {warnings.isLoading ? (
        <LoadingState />
      ) : warnings.isError ? (
        <div className="px-5 pb-5">
          <ErrorState
            message={errorMessage(warnings.error, undefined)}
            onRetry={() => void warnings.refetch()}
          />
        </div>
      ) : rows.length === 0 ? (
        <Empty>Belum ada catatan untuk intern ini.</Empty>
      ) : (
        <div className="grid gap-3 p-5">
          {rows.map((warning) => (
            <div className="announcement" key={warning.id}>
              <div>
                <p>{warning.body}</p>
                <small>
                  {warning.author ?? "Admin"} ·{" "}
                  {warning.created_at ? formatDateTime(warning.created_at) : "-"}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AkhirTab({ id }: { id: string }) {
  const assessment = useMentorAssessmentDetail(id);
  const data: MentorAssessmentDetail | undefined = assessment.data;

  return (
    <Panel title="Akhir Magang" subtitle="Presentasi akhir dan penilaian oleh mentor.">
      {assessment.isLoading ? (
        <LoadingState />
      ) : assessment.isError ? (
        <div className="px-5 pb-5">
          <ErrorState
            message={errorMessage(assessment.error, undefined)}
            onRetry={() => void assessment.refetch()}
          />
        </div>
      ) : data ? (
        <div className="grid gap-4 p-5">
          <div className="info-line">
            <span>
              Presentasi: {labelOf(PRESENTATION_STATUS_LABEL, data.presentation_status, "-")}
            </span>
            <span>
              Status penilaian:{" "}
              <Status status={labelOf(ASSESSMENT_STATUS_LABEL, data.status, data.status)} />
            </span>
            <span>
              Periode:{" "}
              {data.start_date && data.end_date
                ? formatPeriod(data.start_date, data.end_date)
                : "-"}
            </span>
          </div>

          {data.blockers.length > 0 && (
            <div className="banner warn">
              <div>
                <strong>Belum bisa dinilai.</strong>
                <ul className="list-disc pl-5">
                  {data.blockers.map((blocker) => (
                    <li key={blocker.code}>{blocker.text}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {data.unapproved_logbook_days.length > 0 && (
            <div>
              <h3>Logbook belum disetujui</h3>
              <ul className="list-disc pl-5">
                {data.unapproved_logbook_days.map((day) => (
                  <li key={day.date}>
                    {formatDate(day.date)} · {labelOf(LOGBOOK_STATUS_LABEL, day.status, day.status)}{" "}
                    <Link className="text-action" to="/logbook">
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.final_score !== null && (
            <div className="info-line">
              <span>Nilai akhir: {data.final_score}</span>
              <span>Predikat: {data.predicate ?? "-"}</span>
              {data.submitted_at && <span>Disubmit: {formatDateTime(data.submitted_at)}</span>}
            </div>
          )}

          {data.notes && (
            <div>
              <h3>Catatan mentor</h3>
              <p>{data.notes}</p>
            </div>
          )}

          {data.indicators.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th>Indikator</th>
                    <th>Bobot</th>
                    <th>Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {data.indicators.map((indicator) => (
                    <tr key={indicator.id}>
                      <td>{indicator.category ?? "-"}</td>
                      <td>
                        {indicator.name}
                        {indicator.description && (
                          <small className="block text-muted-foreground">
                            {indicator.description}
                          </small>
                        )}
                      </td>
                      <td>{indicator.weight ?? "-"}</td>
                      <td>{indicator.score ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button variant="outline" asChild>
            <Link to="/penilaian" search={{ open: id }}>
              {data.can_assess ? "Nilai intern ini" : "Buka halaman penilaian"}
            </Link>
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}
