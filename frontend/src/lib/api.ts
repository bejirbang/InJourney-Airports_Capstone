import type { Role } from "@/lib/utils";

// Klien REST API Laravel untuk autentikasi (Sanctum mode token/Bearer).
// Basis URL diambil dari VITE_API_URL, bawaan http://localhost:8000 (php artisan serve).
// Fungsi endpoint per role ada di src/lib/endpoints/ (progress.md 4.1).

export type ApiRole = "intern" | "mentor" | "admin";

// Tipe `ApiUser` ada di src/lib/endpoints/auth.ts (progress.md 5.1).

/** Role API (huruf kecil) ke Role tampilan (huruf kapital). */
export const toDisplayRole: Record<ApiRole, Role> = {
  intern: "Intern",
  mentor: "Mentor",
  admin: "Admin",
};

export class ApiError extends Error {
  status: number;
  fields: Record<string, string[]> | undefined;
  /** Alasan penolakan aturan bisnis (422), misalnya `outside_radius` atau `logbook_missing`. */
  reason: string | undefined;
  /** Isi tambahan dari bodi penolakan, misalnya `affected` saat konfirmasi libur lampau. */
  details: Record<string, unknown> | undefined;

  constructor(
    message: string,
    status: number,
    fields?: Record<string, string[]>,
    reason?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.reason = reason;
    this.details = details;
  }
}

export const apiBaseUrl = (
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:8000"
).replace(/\/+$/, "");

const API_URL = apiBaseUrl;

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
  if (status === 429) return "Terlalu banyak permintaan, coba lagi sebentar.";
  if (status >= 500) return "Terjadi kesalahan pada server. Coba lagi nanti.";
  return "Terjadi kesalahan. Coba lagi.";
}

/** `errors` dan `reason` dari bodi 422, untuk ApiError. */
function errorDetails(data: unknown): {
  fields?: Record<string, string[]>;
  reason?: string;
  details?: Record<string, unknown>;
} {
  if (!data || typeof data !== "object") return {};
  const body = data as { errors?: unknown; reason?: unknown };
  return {
    ...(body.errors && typeof body.errors === "object"
      ? { fields: body.errors as Record<string, string[]> }
      : {}),
    ...(typeof body.reason === "string" ? { reason: body.reason } : {}),
    details: body as Record<string, unknown>,
  };
}

export async function request<T>(
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
    const { fields, reason, details } = errorDetails(data);
    if (response.status === 401 && token && typeof window !== "undefined") {
      clearToken();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(
      pickMessage(data, response.status),
      response.status,
      fields,
      reason,
      details,
    );
  }

  return data as T;
}

/** Laravel membungkus resource teratas dalam {"data": ...}, kecuali login. */
export const unwrap = <T>(body: { data?: T } | T): T =>
  body && typeof body === "object" && "data" in (body as Record<string, unknown>)
    ? ((body as { data: T }).data as T)
    : (body as T);

/** Nama file dari header Content-Disposition; server memberi "daftar-kehadiran_....pdf". */
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
 * Unduh berkas terproteksi (Excel, PDF, lampiran izin). Endpoint export memakai POST dengan
 * body JSON dan header Authorization, jadi tidak bisa memakai `<a href>`. Nama file diambil dari
 * `Content-Disposition`; bila tidak ada, memakai `fallbackName`. Bila respons gagal, bodi dibaca
 * sebagai JSON dan dilempar sebagai `ApiError` (bukan file).
 */
export async function downloadFile(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    /** Bearer token; default memakai token yang tersimpan. */
    token?: string | null;
    fallbackName: string;
  },
): Promise<string> {
  const { method = "POST", body, fallbackName } = options;
  const token = options.token === undefined ? internToken() : options.token;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
    const { fields, reason, details } = errorDetails(data);
    if (response.status === 401 && token && typeof window !== "undefined") {
      clearToken();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(
      pickMessage(data, response.status),
      response.status,
      fields,
      reason,
      details,
    );
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
