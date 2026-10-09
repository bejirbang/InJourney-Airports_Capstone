import { describe, it, expect } from 'vitest';
import { canClockOut, canEditReport, canProcessLeave, canCancelLeave, canExport, canSeeWarnings, leaveTypes, reviewTask } from './mock-rules';
describe('PRD rules', () => {
  it('requires a daily report before clock out', () => { expect(canClockOut(true, false, false)).toBe(false); expect(canClockOut(true, true, false)).toBe(true); });
  it('locks a report after clock out', () => { expect(canEditReport(true)).toBe(false); expect(canEditReport(false)).toBe(true); });
  it('only offers sick and urgent leave', () => { expect(leaveTypes).toEqual(['Izin Sakit', 'Izin Urgent']); });
  it('requires evidence for admin approval', () => { expect(canProcessLeave('Admin', 'Pending', false)).toBe(false); expect(canProcessLeave('Admin', 'Pending', true)).toBe(true); });
  it('cannot process previously approved leave', () => { expect(canProcessLeave('Admin', 'Disetujui', true)).toBe(false); });
  it('only cancels pending leave', () => { expect(canCancelLeave('Pending')).toBe(true); expect(canCancelLeave('Disetujui')).toBe(false); });
  it('reserves export for admin', () => { expect(canExport('Mentor')).toBe(false); expect(canExport('Admin')).toBe(true); });
  it('reserves warnings for admin', () => { expect(canSeeWarnings('Intern')).toBe(false); expect(canSeeWarnings('Mentor')).toBe(false); expect(canSeeWarnings('Admin')).toBe(true); });
  it('accepts a task as Done', () => { expect(reviewTask(true)).toBe('Done'); });
  it('returns revised tasks to In Progress', () => { expect(reviewTask(false)).toBe('In Progress'); });
});