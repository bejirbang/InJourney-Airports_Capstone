import { request, setToken, unwrap, type ApiUser } from "@/lib/api";

// Endpoint autentikasi (/api/auth/*). Tanpa unggah foto: avatar memakai inisial nama
// (progress.md 4.1). Tipe ApiUser baru menyusul di Fase 1.

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
};
