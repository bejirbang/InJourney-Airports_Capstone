import { describe, expect, it } from "vitest";
import {
  checkLocation,
  locationMessage,
  validateFileSize,
  distanceMeters,
  validateOffice,
  withinOffice,
  attendanceRate,
  attendanceStatus,
  canDeleteTask,
  canDragTask,
  clockOutCheck,
  formatRange,
  internTaskAction,
  internTaskMove,
  lateLabel,
  leaveSubmittedLate,
  mentorTaskMove,
  needsOverdueReminder,
  taskIsLate,
  todayState,
  validateCorrection,
  validateLeave,
  validatePassword,
  validateReport,
  validateSubmission,
  validateTask,
} from "./mock-rules";

const base = { workday: true, inPeriod: true, approvedLeave: false, clockIn: "", clockOut: "" };

describe("Intern: kehadiran (design-intern.md Alur 2-5)", () => {
  it("menentukan kondisi kartu Hari Ini", () => {
    expect(todayState(base)).toBe("Belum Clock In");
    expect(todayState({ ...base, clockIn: "08:02" })).toBe("Sudah Clock In");
    expect(todayState({ ...base, clockIn: "08:02", clockOut: "17:03" })).toBe("Sudah Clock Out");
    expect(todayState({ ...base, workday: false })).toBe("Libur");
    expect(todayState({ ...base, approvedLeave: true })).toBe("Izin");
    expect(todayState({ ...base, inPeriod: false })).toBe("Di luar periode");
  });
  it("hari yang sudah clock in tetap Hadir walau ada izin", () => {
    expect(attendanceStatus("2026-10-07", "08:00", "17:00", [], true, "2026-10-12")).toBe("Hadir");
  });
  it("hari berjalan yang sudah clock in tampil Berjalan", () => {
    expect(attendanceStatus("2026-10-12", "08:00", "", [], false, "2026-10-12")).toBe("Berjalan");
  });
  it("clock out hanya mensyaratkan Daily Report, sebelum jam pulang perlu konfirmasi", () => {
    expect(clockOutCheck(false, "18:00", "17:00")).toBe("need-report");
    expect(clockOutCheck(true, "15:00", "17:00")).toBe("confirm-early");
    expect(clockOutCheck(true, "17:05", "17:00")).toBe("ok");
  });
  it("Daily Report tidak boleh kosong atau hanya spasi", () => {
    expect(validateReport("   ")).toBe("Isi apa yang Anda kerjakan hari ini.");
    expect(validateReport("Rapat tim")).toBeNull();
  });
});

describe("Koreksi absensi (design-intern.md Alur 7)", () => {
  const ctx = {
    today: "2026-10-12",
    periodStart: "2026-09-01",
    periodEnd: "2026-12-31",
    holidays: [],
    pendingDates: ["2026-10-06"],
  };
  const ok = { date: "2026-10-09", clockIn: "08:00", clockOut: "17:00", reason: "Lupa clock out" };
  it("hanya hari kerja yang sudah lewat atau hari ini", () => {
    expect(validateCorrection({ ...ok, date: "2026-10-13" }, ctx)).toMatch(/hari kerja/);
    expect(validateCorrection({ ...ok, date: "2026-10-10" }, ctx)).toMatch(/hari kerja/);
    expect(validateCorrection(ok, ctx)).toBeNull();
  });
  it("satu permintaan Pending per tanggal", () => {
    expect(validateCorrection({ ...ok, date: "2026-10-06" }, ctx)).toBe(
      "Sudah ada permintaan koreksi untuk tanggal ini.",
    );
  });
  it("clock out harus setelah clock in dan alasan wajib", () => {
    expect(validateCorrection({ ...ok, clockOut: "07:00" }, ctx)).toBe(
      "Jam clock out harus setelah jam clock in.",
    );
    expect(validateCorrection({ ...ok, reason: " " }, ctx)).toBe("Alasan wajib diisi.");
  });
});

describe("Task dan Kanban (design-intern.md 10.2, design-mentor.md 7.2)", () => {
  it("aturan seret untuk Intern", () => {
    expect(internTaskMove("To Do", "In Progress", false)).toEqual({ ok: true, action: "start" });
    expect(internTaskMove("In Progress", "To Do", false)).toEqual({ ok: true, action: "back" });
    expect(internTaskMove("In Progress", "To Do", true).ok).toBe(false);
    expect(internTaskMove("In Progress", "In Review", false)).toEqual({
      ok: true,
      action: "submit",
    });
    expect(internTaskMove("To Do", "In Review", false)).toEqual({
      ok: false,
      message: "Mulai kerjakan Task dulu sebelum mengumpulkan.",
    });
    expect(internTaskMove("In Review", "In Progress", true)).toEqual({
      ok: false,
      message: "Task sedang diperiksa mentor.",
    });
    expect(internTaskMove("In Progress", "Done", true).ok).toBe(false);
  });
  it("aturan seret untuk Mentor: hanya dari In Review", () => {
    expect(mentorTaskMove("In Review", "Done")).toEqual({ ok: true, action: "accept" });
    expect(mentorTaskMove("In Review", "In Progress")).toEqual({ ok: true, action: "revise" });
    expect(mentorTaskMove("In Review", "To Do").ok).toBe(false);
    expect(mentorTaskMove("To Do", "In Progress")).toEqual({
      ok: false,
      message: "Status ini diubah oleh intern.",
    });
    expect(mentorTaskMove("Done", "In Review")).toEqual({
      ok: false,
      message: "Task sudah selesai.",
    });
  });
  it("kartu yang bisa diseret", () => {
    expect(canDragTask("Intern", "In Review")).toBe(false);
    expect(canDragTask("Intern", "To Do")).toBe(true);
    expect(canDragTask("Mentor", "In Review")).toBe(true);
    expect(canDragTask("Mentor", "In Progress")).toBe(false);
  });
  it("tombol di detail Task mengikuti status", () => {
    expect(internTaskAction("To Do")).toBe("Mulai Kerjakan");
    expect(internTaskAction("In Progress")).toBe("Kumpulkan Hasil");
    expect(internTaskAction("In Review")).toBe("Ganti Hasil");
    expect(internTaskAction("Done")).toBeNull();
  });
  it("pengumpulan butuh link atau file dengan format link benar", () => {
    expect(validateSubmission("", "")).toBe("Isi link atau pilih file.");
    expect(validateSubmission("drive.com/x", "")).toBe("Format link tidak valid.");
    expect(validateSubmission("", "hasil.pdf")).toBeNull();
    expect(validateSubmission("https://drive.com/x", "")).toBeNull();
  });
  it("Terlambat tetap bisa dikumpulkan dan ditandai", () => {
    expect(taskIsLate("2026-10-09T17:00", "In Progress", undefined, "2026-10-12T10:00")).toBe(true);
    expect(
      taskIsLate("2026-10-09T17:00", "In Review", "2026-10-10T09:00", "2026-10-12T10:00"),
    ).toBe(true);
    expect(
      taskIsLate("2026-10-09T17:00", "In Review", "2026-10-09T12:00", "2026-10-12T10:00"),
    ).toBe(false);
    expect(taskIsLate("2026-10-09T17:00", "Done", "2026-10-10T09:00", "2026-10-12T10:00")).toBe(
      false,
    );
    expect(lateLabel("2026-10-10T10:00", "2026-10-12T10:00")).toBe("Lewat 2 hari");
  });
  it("pengingat hanya jika lewat lebih dari 2 hari kerja tanpa dikumpulkan", () => {
    expect(needsOverdueReminder("2026-10-07T17:00", "To Do", false, [], "2026-10-12")).toBe(true);
    expect(needsOverdueReminder("2026-10-08T17:00", "To Do", false, [], "2026-10-12")).toBe(false);
    expect(needsOverdueReminder("2026-10-07T17:00", "In Progress", true, [], "2026-10-12")).toBe(
      false,
    );
  });
  it("hapus hanya Task To Do tanpa komentar", () => {
    expect(canDeleteTask("To Do", 0)).toBe(true);
    expect(canDeleteTask("To Do", 1)).toBe(false);
    expect(canDeleteTask("In Progress", 0)).toBe(false);
  });
  it("validasi Buat Task", () => {
    const t = { intern: "Nabila", title: "Desain", description: "x", due: "2026-10-15T17:00" };
    expect(validateTask({ ...t, intern: "" }, "2026-10-12T10:00")).toBe(
      "Pilih intern untuk Task ini.",
    );
    expect(validateTask({ ...t, due: "2026-10-12T09:00" }, "2026-10-12T10:00")).toBe(
      "Tenggat harus setelah waktu sekarang.",
    );
    expect(validateTask(t, "2026-10-12T10:00")).toBeNull();
  });
});

describe("Izin (design-intern.md Alur 11)", () => {
  const ctx = {
    periodStart: "2026-09-01",
    periodEnd: "2026-12-31",
    holidays: [],
    existing: [{ start: "2026-10-14", end: "2026-10-15", status: "Pending" as const }],
  };
  const ok = { type: "Izin Sakit", start: "2026-10-19", end: "2026-10-20", reason: "Demam" };
  it("memvalidasi sesuai pesan dokumen", () => {
    expect(validateLeave({ ...ok, type: "" }, ctx)).toBe("Pilih jenis izin.");
    expect(validateLeave({ ...ok, end: "2026-10-18" }, ctx)).toBe(
      "Tanggal selesai harus sesudah tanggal mulai.",
    );
    expect(validateLeave({ ...ok, start: "2026-08-20" }, ctx)).toBe(
      "Tanggal di luar periode magang.",
    );
    expect(validateLeave({ ...ok, start: "2026-10-17", end: "2026-10-18" }, ctx)).toBe(
      "Tanggal yang dipilih tidak mengandung hari kerja.",
    );
    expect(validateLeave({ ...ok, start: "2026-10-15", end: "2026-10-16" }, ctx)).toBe(
      "Sudah ada izin pada tanggal ini.",
    );
    expect(validateLeave({ ...ok, reason: "" }, ctx)).toBe("Alasan wajib diisi.");
    expect(validateLeave(ok, ctx)).toBeNull();
  });
  it("menandai izin yang diajukan setelah tanggalnya", () => {
    expect(leaveSubmittedLate("2026-10-09", "2026-10-10T09:00")).toBe(true);
    expect(leaveSubmittedLate("2026-10-14", "2026-10-12T07:30")).toBe(false);
  });
  it("format rentang tanggal", () => {
    expect(formatRange("2026-10-13", "2026-10-14")).toBe("13-14 Okt");
    expect(formatRange("2026-10-13", "2026-10-13")).toBe("13 Okt");
    expect(formatRange("2026-09-30", "2026-10-02")).toBe("30 Sep - 2 Okt");
  });
});

describe("Akun dan KPI", () => {
  it("syarat password login pertama", () => {
    expect(validatePassword("pendek1", "pendek1", "sementara")).toMatch(/minimal 8/);
    expect(validatePassword("sementara1", "sementara2", "x")).toMatch(/sama/);
    expect(validatePassword("rahasia123", "rahasia123", "sementara")).toBeNull();
  });
  it("izin yang disetujui tidak dihitung sebagai ketidakhadiran", () => {
    expect(attendanceRate(18, 20, 2)).toBe(1);
    expect(attendanceRate(0, 0, 0)).toBeNull();
  });
});

describe("Lokasi kantor (design-admin.md 9A)", () => {
  const ok = {
    name: "Kantor Pusat",
    lat: -6.1256,
    lng: 106.6559,
    radiusIn: "100",
    radiusOut: "300",
  };
  it("memvalidasi pin, nama, dan radius", () => {
    expect(validateOffice({ ...ok, lat: null }, [])).toBe("Pilih titik kantor di peta.");
    expect(validateOffice({ ...ok, name: " " }, [])).toBe("Nama kantor wajib diisi.");
    expect(validateOffice(ok, ["kantor pusat"])).toBe("Nama kantor sudah dipakai kantor lain.");
    expect(validateOffice({ ...ok, radiusIn: "5" }, [])).toBe(
      "Isi radius antara 10 dan 1000 meter.",
    );
    expect(validateOffice({ ...ok, radiusOut: "1500" }, [])).toBe(
      "Isi radius antara 10 dan 1000 meter.",
    );
    expect(validateOffice(ok, [])).toBeNull();
  });
  it("clock in memakai radius clock in, clock out memakai radius clock out, hanya kantor aktif", () => {
    const office = { lat: -6.1256, lng: 106.6559, radiusIn: 100, radiusOut: 300, active: true };
    const pos = { lat: -6.1256, lng: 106.6577 }; // sekitar 200 m ke timur
    expect(Math.round(distanceMeters(office, pos) / 10) * 10).toBe(200);
    expect(withinOffice(pos, [office], "in")).toBe(false);
    expect(withinOffice(pos, [office], "out")).toBe(true);
    expect(withinOffice(pos, [{ ...office, active: false }], "out")).toBe(false);
  });
});

describe("Validasi lokasi clock in dan clock out (design-intern.md Draft 2)", () => {
  const offices = [{ lat: -6.1256, lng: 106.6559, radiusIn: 100, radiusOut: 300, active: true }];
  const dekat = { lat: -6.1256, lng: 106.6577 };
  it("posisi 200 m: ditolak saat clock in, diterima saat clock out", () => {
    expect(checkLocation(dekat, offices, "in")).toBe("di-luar");
    expect(checkLocation(dekat, offices, "out")).toBe("ok");
  });
  it("tanpa kantor aktif tidak bisa clock in", () => {
    expect(checkLocation(dekat, [{ ...offices[0]!, active: false }], "in")).toBe("tanpa-kantor");
  });
  it("pesan mengikuti dokumen", () => {
    expect(locationMessage("di-luar", "in")).toBe(
      "Lokasi Anda belum sesuai. Clock in belum bisa dilakukan.",
    );
    expect(locationMessage("di-luar", "out")).toBe(
      "Lokasi Anda belum sesuai. Clock out belum bisa dilakukan.",
    );
    expect(locationMessage("ditolak", "out")).toBe(
      "Izinkan akses lokasi di browser untuk melakukan clock out.",
    );
    expect(locationMessage("tanpa-kantor", "in")).toBe(
      "Belum ada kantor aktif. Clock in belum bisa dilakukan. Hubungi admin.",
    );
  });
  it("batas file 2 MB", () => {
    expect(validateFileSize(2 * 1024 * 1024)).toBeNull();
    expect(validateFileSize(2 * 1024 * 1024 + 1)).toBe("Ukuran file maksimal 2 MB.");
  });
});
