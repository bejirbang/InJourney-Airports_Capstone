import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, UNAUTHORIZED_EVENT, clearToken, getToken } from "@/lib/api";
import { authApi, type ApiUser } from "@/lib/endpoints/auth";

// Status sesi autentikasi terhadap backend Laravel.
export type AuthStatus = "loading" | "guest" | "authed";

interface AuthValue {
  status: AuthStatus;
  user: ApiUser | null;
  /** Masuk lewat API. Melempar ApiError bila email/password salah. */
  login: (email: string, password: string) => Promise<ApiUser>;
  /** Keluar: cabut token di server lalu hapus token lokal. */
  logout: () => Promise<void>;
  /** Ganti password sementara, mengembalikan user terbaru. */
  changePassword: (password: string, password_confirmation: string) => Promise<ApiUser>;
  /** Simpan nomor telepon (satu-satunya bagian profil yang bisa diubah), mengembalikan pesan server dan user terbaru. */
  updateProfile: (phone: string | null) => Promise<{ message: string; user: ApiUser }>;
  /** Muat ulang data user dari server. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<ApiUser | null>(null);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setStatus("guest");
      return;
    }
    try {
      setUser(await authApi.me(token));
      setStatus("authed");
    } catch {
      // Token tidak berlaku: request() sudah menghapusnya.
      setUser(null);
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onExpired = () => {
      setUser(null);
      setStatus("guest");
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onExpired);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onExpired);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setUser(result.user);
    setStatus("authed");
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    const token = getToken();
    if (token) {
      try {
        await authApi.logout(token);
      } catch {
        // Token sudah tidak berlaku di server: tetap lanjut bersih-bersih lokal.
      }
    }
    clearToken();
    setUser(null);
    setStatus("guest");
  }, []);

  const changePassword = useCallback(async (password: string, password_confirmation: string) => {
    const token = getToken();
    if (!token) throw new Error("Sesi Anda sudah berakhir. Silakan masuk lagi.");
    const updated = await authApi.changePassword(token, password, password_confirmation);
    setUser(updated);
    setStatus("authed");
    return updated;
  }, []);

  const updateProfile = useCallback(async (phone: string | null) => {
    const token = getToken();
    if (!token) throw new ApiError("Sesi Anda sudah berakhir. Silakan masuk lagi.", 401);
    const result = await authApi.updateProfile(token, phone);
    setUser(result.user);
    return result;
  }, []);

  return (
    <AuthContext.Provider
      value={{ status, user, login, logout, changePassword, updateProfile, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is required");
  return context;
}
