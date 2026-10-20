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

  constructor(
    message: string,
    status: number,
    fields?: Record<string, string[]>,
    reason?: string,
  ) {
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
  | "not_clocked_in"
  | "clocked_in"
  | "clocked_out"
  | "holiday"
  | "on_leave"
  | "outside_period";

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
