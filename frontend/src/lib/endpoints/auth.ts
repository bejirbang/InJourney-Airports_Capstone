import { request, setToken, unwrap, type ApiRole } from "@/lib/api";

// Endpoint autentikasi (/api/auth/*). Tanpa unggah foto: avatar memakai inisial nama
// (progress.md 4.1). Tipe user mengikuti UserResource backend (progress.md 5.1):
// `unit` menggantikan `title`; `title`, `photo_url`, dan `intern_profile.mentor_id` sudah dihapus.

/** Bentuk `GET /api/auth/me`, `POST /api/auth/login`, `PUT /api/auth/password`, dan `PUT /api/auth/profile`. */
export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: ApiRole;
  unit: { id: number; name: string } | null;
  phone: string | null;
  is_active: boolean;
  must_change_password: boolean;
  /** Diabaikan frontend; alamat asli dipilih sendiri (progress.md 4.3). */
  home_path: string;
  /** Hanya untuk akun intern. */
  intern_profile?: {
    mentor: { id: number; name: string };
    airport: { id: number; name: string };
    institution_type: "universitas" | "sekolah" | null;
    university: string;
    major: string;
    student_number: string | null;
    start_date: string;
    end_date: string;
  };
}

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

  /**
   * Satu-satunya bagian profil yang boleh diubah pengguna (progress.md 5.3).
   * `phone` wajib ikut dikirim; kosong dikirim sebagai `null` agar lolos validasi server.
   * Mengembalikan pesan server ("Perubahan tersimpan.") dan user terbaru.
   */
  updateProfile(token: string, phone: string | null): Promise<{ message: string; user: ApiUser }> {
    return request<{ message?: string; data?: ApiUser }>("/api/auth/profile", {
      method: "PUT",
      body: { phone },
      token,
    }).then((body) => ({
      message: body.message ?? "Perubahan tersimpan.",
      user: unwrap<ApiUser>(body),
    }));
  },
};
