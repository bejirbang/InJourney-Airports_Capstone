import { describe, it, expect } from 'vitest';
import { formatDate, workingDays, isOverduePending, attendanceStatus, canDecideCorrection, canApproveLeave, canRejectLeave, isAutoInactive, endsWithin, canExtend, deactivateBlock, validateAccount, canEditWarning, audienceValid, announcementVisible, timeAfter, type Account } from './mock-rules';
const people: Account[] = [
  { id: 1, name: 'Ayu', email: 'ayu@x.id', role: 'Admin', active: true, mentor: '—', end: '—' },
  { id: 2, name: 'Budi', email: 'budi@x.id', role: 'Mentor', active: true, mentor: '—', end: '—' },
  { id: 3, name: 'Nabila', email: 'nabila@x.id', role: 'Intern', active: true, mentor: 'Budi', end: '2026-12-31' },
  { id: 4, name: 'Sari', email: 'sari@x.id', role: 'Mentor', active: true, mentor: '—', end: '—' },
];
const input = { name: 'Baru', email: 'baru@x.id', role: 'Intern' as const, mentor: 'Budi', start: '2026-11-01', end: '2027-01-31' };
describe('Admin rules', () => {
  it('formats dates as "Sen, 12 Okt 2026"', () => { expect(formatDate('2026-10-12')).toBe('Sen, 12 Okt 2026'); });
  it('skips weekends and holidays when counting working days', () => { expect(workingDays('2026-10-09', '2026-10-13', [])).toBe(3); expect(workingDays('2026-10-09', '2026-10-13', ['2026-10-12'])).toBe(2); });
  it('flags leave pending more than 24 hours', () => { expect(isOverduePending('Pending', '2026-10-08T14:00', '2026-10-09T14:39')).toBe(true); expect(isOverduePending('Pending', '2026-10-09T09:00', '2026-10-09T14:39')).toBe(false); expect(isOverduePending('Disetujui', '2026-10-01T09:00', '2026-10-09T14:39')).toBe(false); });
  it('does not mark today as Tidak Hadir before the day closes', () => { expect(attendanceStatus('2026-10-09', '', '', [], false, '2026-10-09')).toBe('Belum Clock In'); expect(attendanceStatus('2026-10-08', '', '', [], false, '2026-10-09')).toBe('Tidak Hadir'); });
  it('derives Libur, Izin and Lupa Clock Out', () => { expect(attendanceStatus('2026-10-10', '', '', [], false)).toBe('Libur'); expect(attendanceStatus('2026-10-07', '', '', ['2026-10-07'], false)).toBe('Libur'); expect(attendanceStatus('2026-10-07', '', '', [], true)).toBe('Izin'); expect(attendanceStatus('2026-10-07', '08:00', '', [], false)).toBe('Lupa Clock Out'); });
  it('requires a verification note and clock out after clock in for corrections', () => { expect(canDecideCorrection('Pending', '', '08:00', '17:00')).toBe(false); expect(canDecideCorrection('Pending', 'ok', '17:00', '08:00')).toBe(false); expect(canDecideCorrection('Pending', 'ok', '08:00', '17:00')).toBe(true); expect(canDecideCorrection('Disetujui', 'ok', '08:00', '17:00')).toBe(false); });
  it('approves leave only with evidence, checkbox and note', () => { expect(canApproveLeave('Pending', false, true, 'ok')).toBe(false); expect(canApproveLeave('Pending', true, false, 'ok')).toBe(false); expect(canApproveLeave('Pending', true, true, '')).toBe(false); expect(canApproveLeave('Pending', true, true, 'ok')).toBe(true); });
  it('allows rejecting without evidence but requires a note', () => { expect(canRejectLeave('Pending', 'Tidak ada bukti')).toBe(true); expect(canRejectLeave('Pending', ' ')).toBe(false); expect(canRejectLeave('Dibatalkan', 'x')).toBe(false); });
  it('deactivates automatically the day after the internship ends', () => { expect(isAutoInactive('2026-10-09', '2026-10-09')).toBe(false); expect(isAutoInactive('2026-10-08', '2026-10-09')).toBe(true); });
  it('lists internships ending within 7 days', () => { expect(endsWithin('2026-10-16', 7, '2026-10-09')).toBe(true); expect(endsWithin('2026-10-17', 7, '2026-10-09')).toBe(false); });
  it('extension must be after the current end date', () => { expect(canExtend('2026-10-16', '2026-10-16')).toBe(false); expect(canExtend('2026-10-16', '2026-11-16')).toBe(true); });
  it('blocks deactivating yourself', () => { expect(deactivateBlock(people[0], 1, people)).toMatch(/sendiri/); });
  it('keeps at least one active admin', () => { expect(deactivateBlock(people[0], 99, people)).toMatch(/minimal satu admin/); });
  it('blocks deactivating a mentor with active interns', () => { expect(deactivateBlock(people[1], 1, people)).toMatch(/Pindahkan intern/); expect(deactivateBlock(people[3], 1, people)).toBeNull(); });
  it('validates new accounts with the PRD messages', () => {
    expect(validateAccount({ ...input, name: '' }, people)).toBe('Nama wajib diisi.');
    expect(validateAccount({ ...input, email: 'NABILA@x.id' }, people)).toBe('Email sudah terdaftar.');
    expect(validateAccount({ ...input, mentor: '' }, people)).toBe('Pilih mentor untuk intern ini.');
    expect(validateAccount({ ...input, end: '2026-10-01' }, people)).toBe('Tanggal selesai harus sesudah tanggal mulai.');
    expect(validateAccount(input, people)).toBeNull();
  });
  it('only lets the author edit a warning within 24 hours', () => { expect(canEditWarning('Ayu', 'Ayu', '2026-10-09T08:00', '2026-10-09T14:39')).toBe(true); expect(canEditWarning('Ayu', 'Ayu', '2026-10-07T08:00', '2026-10-09T14:39')).toBe(false); expect(canEditWarning('Rina', 'Ayu', '2026-10-09T08:00', '2026-10-09T14:39')).toBe(false); });
  it('requires at least one announcement audience', () => { expect(audienceValid(false, false)).toBe(false); expect(audienceValid(true, false)).toBe(true); });
  it('shows announcements only to chosen roles', () => { expect(announcementVisible('Mentor', 'Intern')).toBe(false); expect(announcementVisible('Intern & Mentor', 'Intern')).toBe(true); });
  it('requires work end time after start time', () => { expect(timeAfter('17:00', '08:00')).toBe(false); expect(timeAfter('08:00', '17:00')).toBe(true); });
});
