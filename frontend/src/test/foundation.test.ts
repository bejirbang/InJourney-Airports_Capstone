import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, downloadFile, request, setToken, UNAUTHORIZED_EVENT } from "@/lib/api";
import {
  ATTENDANCE_STATUS_LABEL,
  CORRECTION_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  LOGBOOK_STATUS_LABEL,
  WEEKDAY_LABEL,
  labelOf,
} from "@/lib/labels";
import { menuRoute, notificationRoute } from "@/lib/navigation";

describe("labels", () => {
  it("menampilkan label Indonesia untuk nilai API", () => {
    expect(ATTENDANCE_STATUS_LABEL["present"]).toBe("Hadir");
    expect(ATTENDANCE_STATUS_LABEL["missed_clock_in"]).toBe("Lupa Clock In");
    expect(LOGBOOK_STATUS_LABEL["missing"]).toBe("Belum Diisi");
    expect(CORRECTION_STATUS_LABEL["pending_mentor"]).toBe("Menunggu Mentor");
    expect(LEAVE_TYPE_LABEL["sick"]).toBe("Izin Sakit");
    expect(WEEKDAY_LABEL[1]).toBe("Senin");
    expect(WEEKDAY_LABEL[7]).toBe("Minggu");
  });

  it("labelOf memakai fallback untuk nilai kosong atau tidak dikenal", () => {
    expect(labelOf(ATTENDANCE_STATUS_LABEL, "late")).toBe("Terlambat");
    expect(labelOf(ATTENDANCE_STATUS_LABEL, "unknown")).toBe("-");
    expect(labelOf(ATTENDANCE_STATUS_LABEL, null)).toBe("-");
    expect(labelOf(ATTENDANCE_STATUS_LABEL, undefined, "Belum ada")).toBe("Belum ada");
  });
});

describe("navigation", () => {
  it("memetakan key menu ke route frontend", () => {
    expect(menuRoute("dashboard")).toBe("/");
    expect(menuRoute("attendance")).toBe("/absensi");
    expect(menuRoute("logbooks")).toBe("/logbook");
    expect(menuRoute("corrections")).toBe("/koreksi");
    expect(menuRoute("audit_log")).toBe("/log");
  });

  it("mengembalikan null untuk key menu yang tidak dikenal", () => {
    expect(menuRoute("task")).toBeNull();
    expect(menuRoute("")).toBeNull();
  });

  it("memetakan link_path notifikasi ke route frontend", () => {
    expect(notificationRoute("/")).toBe("/");
    expect(notificationRoute("/presensi")).toBe("/absensi");
    expect(notificationRoute("/logbook")).toBe("/logbook");
    expect(notificationRoute("/penilaian")).toBe("/penilaian");
  });

  it("mengembalikan null untuk link_path yang tidak dikenal", () => {
    expect(notificationRoute("/task")).toBeNull();
    expect(notificationRoute("/admin/xyz")).toBeNull();
  });
});

describe("downloadFile", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let anchorClick: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.setItem("internspace_token", "token-tes");
    URL.createObjectURL = vi.fn(() => "blob:unduhan");
    URL.revokeObjectURL = vi.fn();
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.removeItem("internspace_token");
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    anchorClick.mockRestore();
    vi.unstubAllGlobals();
  });

  const jsonResponse = (body: unknown, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => body,
      blob: async () => new Blob(["isi"]),
    }) as unknown as Response;

  it("mengirim POST dengan body JSON dan token, lalu menyimpan blob", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers({
            "Content-Disposition": 'attachment; filename="daftar-kehadiran_Oktober.pdf"',
          }),
          json: async () => ({}),
          blob: async () => new Blob(["isi"]),
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    const name = await downloadFile("/api/admin/attendance/export", {
      body: { month: "2026-10" },
      fallbackName: "rekap.pdf",
    });

    expect(name).toBe("daftar-kehadiran_Oktober.pdf");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith("/api/admin/attendance/export")).toBe(true);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ month: "2026-10" }));
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer token-tes");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
  });

  it("memakai fallbackName bila Content-Disposition tidak ada", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({}),
            blob: async () => new Blob(["isi"]),
          }) as unknown as Response,
      ),
    );

    await expect(
      downloadFile("/laporan", { method: "GET", fallbackName: "laporan.pdf" }),
    ).resolves.toBe("laporan.pdf");
  });

  it("melempar ApiError berisi pesan server saat respons gagal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Bulan tidak valid." }, 422)),
    );

    const error = await downloadFile("/api/admin/attendance/export", {
      fallbackName: "rekap.pdf",
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe("Bulan tidak valid.");
    expect((error as ApiError).status).toBe(422);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe("pesan error internal", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tidak menampilkan SQL mentah dari respons 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: false,
            status: 500,
            json: async () => ({
              message:
                'SQLSTATE[42803]: Grouping error: 7 ERROR: column "chat_messages.sender_id" must appear in the GROUP BY clause',
            }),
          }) as Response,
      ),
    );

    await expect(request("/api/intern/chats", { token: "token-tes" })).rejects.toThrow(
      "Terjadi kesalahan pada server. Coba lagi nanti.",
    );
  });
});

describe("sesi berakhir (401)", () => {
  const jsonResponse = (body: unknown, status = 200) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
  let handler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.setItem("internspace_token", "token-tes");
    handler = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, handler as unknown as EventListener);
  });

  afterEach(() => {
    window.removeEventListener(UNAUTHORIZED_EVENT, handler as unknown as EventListener);
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  // AuthGate (routes/__root.tsx) menangani event ini dengan pindah ke /login.
  it("menghapus token dan memberi tahu AuthGate untuk kembali ke /login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Sesi berakhir." }, 401)),
    );

    await expect(request("/api/auth/me", { token: "token-tes" })).rejects.toThrow("Sesi berakhir.");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("internspace_token")).toBeNull();
  });
});
