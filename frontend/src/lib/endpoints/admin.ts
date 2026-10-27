import { request, unwrap } from "@/lib/api";

// Semua endpoint /api/admin/* beserta tipe responsnya (progress.md 4.1).
// Bagian Lokasi (bandara, titik presensi) dan Pengaturan (jadwal, libur).

// ---- Lokasi kantor admin (AdminOfficeController) ----

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

// ---- Jam kerja & kalender libur admin (WorkSchedules + AdminHolidays) ----

/** Satu hari pada jadwal mingguan bandara (1 = Senin ... 7 = Minggu). */
export interface WeeklyDay {
  day_of_week: number;
  is_workday: boolean;
  start_time: string | null;
  end_time: string | null;
}

/** Satu set jadwal mingguan yang berlaku sejak `effective_from`. */
export interface WeeklySet {
  effective_from: string;
  days: WeeklyDay[];
  summary: string;
}

export interface AdminHoliday {
  id: number;
  date: string;
  name: string;
  /** Tanggal lampau: menyimpannya butuh konfirmasi (presensi dihitung ulang). */
  is_past: boolean;
}

export interface HolidayInput {
  date: string;
  name: string;
  /** true saat mengirim ulang setelah server minta konfirmasi tanggal lampau. */
  confirm?: boolean;
}

export const scheduleApi = {
  /** Riwayat jadwal mingguan bandara, yang berlaku sekarang di urutan teratas. */
  weekly(token: string, airport: number): Promise<WeeklySet[]> {
    return request<{ data?: WeeklySet[] } | WeeklySet[]>(
      `/api/admin/airports/${airport}/weekly-schedules`,
      {
        token,
      },
    ).then(unwrap<WeeklySet[]>);
  },

  /** Hari yang tidak dikirim otomatis disalin dari jadwal sebelumnya; frontend selalu mengirim 7 hari. */
  saveWeekly(
    token: string,
    airport: number,
    input: { effective_from: string; days: WeeklyDay[] },
  ): Promise<WeeklySet> {
    return request<{ data?: WeeklySet } | WeeklySet>(
      `/api/admin/airports/${airport}/weekly-schedule`,
      {
        method: "PUT",
        body: input,
        token,
      },
    ).then(unwrap<WeeklySet>);
  },

  holidays(token: string): Promise<AdminHoliday[]> {
    return request<{ data?: AdminHoliday[] } | AdminHoliday[]>("/api/admin/holidays", {
      token,
    }).then(unwrap<AdminHoliday[]>);
  },

  /** Tanggal lampau tanpa `confirm` ditolak server dengan reason `confirm_recalculate`. */
  saveHoliday(
    token: string,
    input: HolidayInput,
    id?: number,
  ): Promise<{ message: string; data: AdminHoliday }> {
    return request(id === undefined ? "/api/admin/holidays" : `/api/admin/holidays/${id}`, {
      method: id === undefined ? "POST" : "PUT",
      body: input,
      token,
    });
  },

  deleteHoliday(token: string, id: number): Promise<{ message: string }> {
    return request(`/api/admin/holidays/${id}`, { method: "DELETE", token });
  },
};
