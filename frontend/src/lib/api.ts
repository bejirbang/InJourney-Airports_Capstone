import type { Role } from "@/lib/mock-rules";

// Klien REST API Laravel untuk autentikasi (Sanctum mode token/Bearer).
// Basis URL diambil dari VITE_API_URL, bawaan http://localhost:8000 (php artisan serve).

export type ApiRole = "intern" | "mentor" | "admin";

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: ApiRole;
  title: string | null;
  phone: string | null;
  photo_url: string | null;
  is_active: boolean;
  must_change_password: boolean;
  intern_profile?: {
    mentor_id: number | null;
    start_date: string;
    end_date: string;
  } | null;
}

/** Role API (huruf kecil) ke Role tampilan (huruf kapital). */
export const toMockRole: Record<ApiRole, Role> = {
  intern: "Intern",
  mentor: "Mentor",
  admin: "Admin",
};

export class ApiError extends Error {
  status: number;
  fields: Record<string, string[]> | undefined;
  /** Alasan penolakan aturan bisnis (422), misalnya `outside_radius` atau `daily_report_missing`. */
  reason: string | undefined;

  constructor(message: string, status: number, fields?: Record<string, string[]>, reason?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.reason = reason;
  }
}

const API_URL = (
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:8000"
).replace(/\/+$/, "");

const TOKEN_KEY = "internspace_token";

/** Kejadian saat token tidak berlaku lagi (401) agar AuthProvider bisa keluar otomatis. */
export const UNAUTHORIZED_EVENT = "internspace:unauthorized";

const storage =
  typeof window === "undefined"
    ? null
    : (() => {
        try {
          return window.localStorage;
        } catch {
          return null;
        }
      })();

export const getToken = () => storage?.getItem(TOKEN_KEY) ?? null;
export const setToken = (token: string) => storage?.setItem(TOKEN_KEY, token);
export const clearToken = () => storage?.removeItem(TOKEN_KEY);

/** Token yang tersimpan; dilempar sebagai 401 bila sesi sudah berakhir. */
export const internToken = (): string => {
  const token = getToken();
  if (!token) throw new ApiError("Sesi Anda sudah berakhir. Silakan masuk lagi.", 401);
  return token;
};

function pickMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const data = body as { message?: unknown; errors?: unknown };
    if (typeof data.message === "string" && data.message) return data.message;
    if (data.errors && typeof data.errors === "object") {
      for (const value of Object.values(data.errors as Record<string, unknown>)) {
        if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      }
    }
  }
  if (status === 401) return "Sesi Anda sudah berakhir. Silakan masuk lagi.";
  if (status === 429) return "Terlalu banyak percobaan. Coba lagi dalam satu menit.";
  if (status >= 500) return "Terjadi kesalahan pada server. Coba lagi nanti.";
  return "Terjadi kesalahan. Coba lagi.";
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; formData?: FormData; token?: string | null } = {},
): Promise<T> {
  const { method = "GET", body, formData, token } = options;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(formData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(formData ? { body: formData } : body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError("Tidak bisa menghubungi server. Periksa koneksi dan API.", 0);
  }

  let data: unknown = null;
  try {
    if (response.status !== 204) data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const fields =
      data && typeof data === "object" && (data as { errors?: unknown }).errors
        ? ((data as { errors: Record<string, string[]> }).errors as Record<string, string[]>)
        : undefined;
    const reason =
      data && typeof data === "object" && typeof (data as { reason?: unknown }).reason === "string"
        ? (data as { reason: string }).reason
        : undefined;
    if (response.status === 401 && token && typeof window !== "undefined") {
      clearToken();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(pickMessage(data, response.status), response.status, fields, reason);
  }

  return data as T;
}

/** Laravel membungkus resource teratas dalam {"data": ...}, kecuali login. */
const unwrap = <T>(body: { data?: T } | T): T =>
  body && typeof body === "object" && "data" in (body as Record<string, unknown>)
    ? ((body as { data: T }).data as T)
    : (body as T);

export type ApiTodayState =
  "not_clocked_in" | "clocked_in" | "clocked_out" | "holiday" | "on_leave" | "outside_period";

export interface TodayStatus {
  state: ApiTodayState;
  clock_in_at: string | null;
  clock_out_at: string | null;
  late_minutes: number | null;
  daily_report_sent: boolean;
  holiday_name: string | null;
  leave_type: "sick" | "urgent" | null;
  has_active_office: boolean;
  work_hours: { start: string; end: string } | null;
}

export interface InternDashboard {
  date: string;
  today: TodayStatus;
  daily_report_reminder: boolean;
}

export interface OfficeInfo {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  clock_in_radius_meters: number;
  clock_out_radius_meters: number;
}

export interface DailyReportData {
  id: number;
  date: string;
  work: string;
  notes: string | null;
  sent_at: string;
  editable: boolean;
}

export interface AttendanceRecord {
  id: number;
  date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  late_minutes: number | null;
  clock_in_office?: { id: number; name: string } | null;
  clock_out_office?: { id: number; name: string } | null;
  is_corrected: boolean;
}

export interface GeoPosition {
  lat: number;
  lng: number;
}

export const attendanceApi = {
  dashboard(token: string): Promise<InternDashboard> {
    return request<{ data?: InternDashboard } | InternDashboard>("/api/intern/dashboard", {
      token,
    }).then(unwrap<InternDashboard>);
  },

  offices(token: string): Promise<OfficeInfo[]> {
    return request<{ data?: OfficeInfo[] } | OfficeInfo[]>("/api/intern/offices", {
      token,
    }).then(unwrap<OfficeInfo[]>);
  },

  clockIn(
    token: string,
    position: GeoPosition,
  ): Promise<{ message: string; data: AttendanceRecord }> {
    return request("/api/intern/attendance/clock-in", {
      method: "POST",
      body: { latitude: position.lat, longitude: position.lng },
      token,
    });
  },

  clockOut(
    token: string,
    position: GeoPosition,
  ): Promise<{ message: string; data: AttendanceRecord }> {
    return request("/api/intern/attendance/clock-out", {
      method: "POST",
      body: { latitude: position.lat, longitude: position.lng },
      token,
    });
  },

  /** `data` null jika Daily Report hari ini belum dikirim. */
  dailyReport(token: string): Promise<DailyReportData | null> {
    return request<{ data?: DailyReportData | null } | DailyReportData | null>(
      "/api/intern/attendance/daily-report",
      { token },
    ).then(unwrap<DailyReportData | null>);
  },

  saveDailyReport(
    token: string,
    input: { work: string; notes: string | null },
  ): Promise<{ message: string; data: DailyReportData }> {
    return request("/api/intern/attendance/daily-report", {
      method: "PUT",
      body: input,
      token,
    });
  },
};

// ---- Task intern (Alur 8 dan 9) ----

export type ApiTaskStatus = "todo" | "in_progress" | "in_review" | "done";

export interface ApiTaskComment {
  id: number;
  author: { id: number; name: string; role: ApiRole } | null;
  body: string;
  is_revision: boolean;
  is_unread: boolean;
  created_at: string | null;
}

export interface ApiTaskSubmission {
  link: string | null;
  file: { name: string; size: number | null } | null;
  submitted_at: string;
  submitted_late: boolean;
  late_hours: number | null;
}

/** Kartu Task intern. Field detail hanya ikut pada `GET /api/intern/tasks/{task}`. */
export interface ApiInternTask {
  id: number;
  code: string;
  title: string;
  mentor: { id: number; name: string } | null;
  status: ApiTaskStatus;
  due_at: string;
  is_late: boolean;
  late_label: string | null;
  done_at: string | null;
  unread_comments: number;
  ever_submitted: boolean;
  revise_pending: boolean;
  /** Tombol di detail: start = Mulai Kerjakan, submit = Kumpulkan Hasil, replace = Ganti Hasil. */
  action: "start" | "submit" | "replace" | null;
  description?: string;
  submission?: ApiTaskSubmission | null;
  /** Thread terkunci pada Task Done. */
  can_comment?: boolean;
  comments?: ApiTaskComment[];
}

export interface TaskListParams {
  status?: ApiTaskStatus;
  late?: boolean;
  q?: string;
  sort?: "due" | "newest";
  include_older_done?: boolean;
}

/** Nama file dari header Content-Disposition; server memberi "hasil-TSK-024.pdf". */
function downloadName(disposition: string | null): string | null {
  if (!disposition) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return utf8[1];
    }
  }
  return /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? null;
}

/**
 * Unduh berkas terproteksi (file hasil Task, lampiran izin). Berkas tidak punya URL publik,
 * jadi diambil dengan Bearer token lalu dibuka lewat blob.
 */
async function downloadAttachment(
  path: string,
  token: string,
  fallbackName: string,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { Accept: "*/*", Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError("Tidak bisa menghubungi server. Periksa koneksi dan API.", 0);
  }

  if (!response.ok) {
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (response.status === 401 && typeof window !== "undefined") {
      clearToken();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(pickMessage(data, response.status), response.status);
  }

  const name = downloadName(response.headers.get("Content-Disposition")) ?? fallbackName;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return name;
}

export const taskApi = {
  list(
    token: string,
    params: TaskListParams = {},
  ): Promise<{ tasks: ApiInternTask[]; hiddenDone: number }> {
    const search = new URLSearchParams();
    if (params.status) search.set("status", params.status);
    if (params.late) search.set("late", "1");
    if (params.q) search.set("q", params.q);
    if (params.sort) search.set("sort", params.sort);
    if (params.include_older_done) search.set("include_older_done", "1");
    const query = search.toString();

    return request<{ data?: ApiInternTask[]; meta?: { hidden_done?: number } }>(
      `/api/intern/tasks${query ? `?${query}` : ""}`,
      { token },
    ).then((body) => ({
      tasks: unwrap<ApiInternTask[]>(body),
      hiddenDone: body.meta?.hidden_done ?? 0,
    }));
  },

  /** Detail lengkap: deskripsi, hasil kumpulan, dan thread komentar. Membuka detail menandai komentar terbaca. */
  show(token: string, task: number): Promise<ApiInternTask> {
    return request<{ data?: ApiInternTask } | ApiInternTask>(`/api/intern/tasks/${task}`, {
      token,
    }).then(unwrap<ApiInternTask>);
  },

  move(
    token: string,
    task: number,
    to: ApiTaskStatus,
    from?: ApiTaskStatus,
  ): Promise<ApiInternTask> {
    return request<{ data?: ApiInternTask } | ApiInternTask>(`/api/intern/tasks/${task}/move`, {
      method: "POST",
      body: { to, ...(from ? { from } : {}) },
      token,
    }).then(unwrap<ApiInternTask>);
  },

  /** Kumpulkan atau ganti hasil (multipart: link, file, from). */
  submit(
    token: string,
    task: number,
    input: { link?: string | null; file?: File | null; from?: ApiTaskStatus },
  ): Promise<{ message: string; task: ApiInternTask }> {
    const formData = new FormData();
    if (input.link) formData.append("link", input.link);
    if (input.file) formData.append("file", input.file);
    if (input.from) formData.append("from", input.from);

    return request<{ message?: string; data?: ApiInternTask }>(
      `/api/intern/tasks/${task}/submission`,
      { method: "POST", formData, token },
    ).then((body) => ({
      message: body.message ?? "Hasil terkumpul. Menunggu pemeriksaan mentor.",
      task: unwrap<ApiInternTask>(body),
    }));
  },

  comment(token: string, task: number, body: string): Promise<ApiTaskComment> {
    return request<{ data?: ApiTaskComment } | ApiTaskComment>(
      `/api/intern/tasks/${task}/comments`,
      {
        method: "POST",
        body: { body },
        token,
      },
    ).then(unwrap<ApiTaskComment>);
  },

  /** Unduh file hasil: diambil dengan Bearer token karena tidak punya URL publik. */
  downloadFile(token: string, task: number, fallbackName: string): Promise<string> {
    return downloadAttachment(`/api/intern/tasks/${task}/submission/file`, token, fallbackName);
  },
};

// ---- Lokasi kantor admin (Admin OfficeController) ----

/** Referensi bandara pemilik kantor (`AdminOfficeResource`). */
export interface AdminOfficeAirport {
  id: number;
  name: string;
}

/** Kantor dari sisi admin: lengkap dengan bandara pemilik dan status aktif. */
export interface AdminOffice {
  id: number;
  airport_id: number;
  name: string;
  latitude: number;
  longitude: number;
  clock_in_radius_meters: number;
  clock_out_radius_meters: number;
  is_active: boolean;
  airport: AdminOfficeAirport | null;
}

/** Ringkasan bandara untuk dropdown bandara pemilik kantor (`AdminAirports::summary`). */
export interface AdminAirport {
  id: number;
  name: string;
  city: string;
  is_active: boolean;
  active_offices: number;
  active_interns: number;
}

export interface AdminOfficeInput {
  airport_id: number;
  name: string;
  latitude: number;
  longitude: number;
  clock_in_radius_meters: number;
  clock_out_radius_meters: number;
}

export const officeApi = {
  list(token: string): Promise<{ offices: AdminOffice[]; activeCount: number }> {
    return request<{ data?: AdminOffice[]; meta?: { active_count?: number } }>(
      "/api/admin/offices",
      { token },
    ).then((body) => ({
      offices: unwrap<AdminOffice[]>(body),
      activeCount: body.meta?.active_count ?? 0,
    }));
  },

  /** Bandara yang tersedia untuk dipilih sebagai pemilik kantor. */
  airports(token: string): Promise<AdminAirport[]> {
    return request<{ data?: AdminAirport[] } | AdminAirport[]>("/api/admin/airports", {
      token,
    }).then(unwrap<AdminAirport[]>);
  },

  /** Kantor baru selalu aktif; intern bandara pemilik langsung bisa memakainya. */
  store(token: string, input: AdminOfficeInput): Promise<AdminOffice> {
    return request<{ data?: AdminOffice } | AdminOffice>("/api/admin/offices", {
      method: "POST",
      body: input,
      token,
    }).then(unwrap<AdminOffice>);
  },

  /** Backend tidak memindahkan kantor ke bandara lain; `airport_id` ikut dikirim agar validasi lolos. */
  update(token: string, id: number, input: AdminOfficeInput): Promise<AdminOffice> {
    return request<{ data?: AdminOffice } | AdminOffice>(`/api/admin/offices/${id}`, {
      method: "PUT",
      body: input,
      token,
    }).then(unwrap<AdminOffice>);
  },

  /** Kantor tidak dihapus, hanya dinonaktifkan (riwayat presensi tetap menunjuk kantor ini). */
  deactivate(token: string, id: number): Promise<AdminOffice> {
    return request<{ data?: AdminOffice } | AdminOffice>(`/api/admin/offices/${id}/deactivate`, {
      method: "POST",
      token,
    }).then(unwrap<AdminOffice>);
  },

  activate(token: string, id: number): Promise<AdminOffice> {
    return request<{ data?: AdminOffice } | AdminOffice>(`/api/admin/offices/${id}/activate`, {
      method: "POST",
      token,
    }).then(unwrap<AdminOffice>);
  },
};

// ---- Izin intern (Alur 11) ----

export type ApiLeaveType = "sick" | "urgent";
export type ApiLeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Izin dari sisi intern (`InternLeaveResource`). */
export interface ApiInternLeave {
  id: number;
  type: ApiLeaveType;
  start_date: string;
  end_date: string;
  /** Dihitung server saat dibaca, jadi libur yang ditambahkan admin ikut mengurangi. */
  working_days: number;
  reason: string;
  has_evidence: boolean;
  status: ApiLeaveStatus;
  submitted_at: string;
  submitted_late: boolean;
  /** Mentor atau admin yang memutuskan; null selama Pending. */
  decided_by: { name: string; role: ApiRole } | null | undefined;
  decision_note: string | null;
  decided_at: string | null;
  /** Hanya izin Pending yang boleh dibatalkan intern. */
  can_cancel: boolean;
}

export interface LeaveListParams {
  status?: ApiLeaveStatus;
}

export const leaveApi = {
  list(token: string, params: LeaveListParams = {}): Promise<ApiInternLeave[]> {
    const query = params.status ? `?status=${params.status}` : "";
    return request<{ data?: ApiInternLeave[] } | ApiInternLeave[]>(`/api/intern/leaves${query}`, {
      token,
    }).then(unwrap<ApiInternLeave[]>);
  },

  /** "Total: 2 hari kerja" di formulir izin; server memakai kalender libur terbaru. */
  workingDays(token: string, start: string, end: string): Promise<number> {
    return request<{ data?: { working_days: number } }>(
      `/api/intern/leaves/working-days?start_date=${start}&end_date=${end}`,
      { token },
    ).then((body) => unwrap<{ working_days: number }>(body).working_days);
  },

  /** Ajukan izin (multipart: type, start_date, end_date, reason, evidence). */
  store(
    token: string,
    input: {
      type: ApiLeaveType;
      start_date: string;
      end_date: string;
      reason: string;
      evidence?: File | null;
    },
  ): Promise<{ message: string; leave: ApiInternLeave }> {
    const formData = new FormData();
    formData.append("type", input.type);
    formData.append("start_date", input.start_date);
    formData.append("end_date", input.end_date);
    formData.append("reason", input.reason);
    if (input.evidence) formData.append("evidence", input.evidence);

    return request<{ message?: string; data?: ApiInternLeave }>("/api/intern/leaves", {
      method: "POST",
      formData,
      token,
    }).then((body) => ({
      message: body.message ?? "Izin diajukan. Menunggu mentor.",
      leave: unwrap<ApiInternLeave>(body),
    }));
  },

  show(token: string, leave: number): Promise<ApiInternLeave> {
    return request<{ data?: ApiInternLeave } | ApiInternLeave>(`/api/intern/leaves/${leave}`, {
      token,
    }).then(unwrap<ApiInternLeave>);
  },

  /** Batalkan izin Pending. Ditolak 422 bila sudah diproses mentor atau admin. */
  cancel(token: string, leave: number): Promise<{ message: string; leave: ApiInternLeave }> {
    return request<{ message?: string; data?: ApiInternLeave }>(
      `/api/intern/leaves/${leave}/cancel`,
      { method: "POST", token },
    ).then((body) => ({
      message: body.message ?? "Pengajuan izin dibatalkan.",
      leave: unwrap<ApiInternLeave>(body),
    }));
  },

  /** Unduh lampiran bukti; file tidak punya URL publik. */
  evidence(token: string, leave: number, fallbackName: string): Promise<string> {
    return downloadAttachment(`/api/intern/leaves/${leave}/evidence`, token, fallbackName);
  },
};

export const authApi = {
  async login(email: string, password: string): Promise<{ token: string; user: ApiUser }> {
    const result = await request<{ token: string; user: ApiUser }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(result.token);
    return result;
  },

  me(token: string): Promise<ApiUser> {
    return request<{ data?: ApiUser } | ApiUser>("/api/auth/me", { token }).then(unwrap<ApiUser>);
  },

  logout(token: string): Promise<void> {
    return request<void>("/api/auth/logout", { method: "POST", token }).then(() => undefined);
  },

  changePassword(token: string, password: string, password_confirmation: string): Promise<ApiUser> {
    return request<{ data?: ApiUser } | ApiUser>("/api/auth/password", {
      method: "PUT",
      body: { password, password_confirmation },
      token,
    }).then(unwrap<ApiUser>);
  },

  updateProfile(token: string, input: { name: string; phone: string }): Promise<ApiUser> {
    return request<{ data?: ApiUser } | ApiUser>("/api/auth/profile", {
      method: "PUT",
      body: input,
      token,
    }).then(unwrap<ApiUser>);
  },

  uploadPhoto(token: string, photo: File): Promise<ApiUser> {
    const formData = new FormData();
    formData.append("photo", photo);
    return request<{ data?: ApiUser } | ApiUser>("/api/auth/profile/photo", {
      method: "POST",
      formData,
      token,
    }).then(unwrap<ApiUser>);
  },
};
