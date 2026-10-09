import { CalendarDays, ArrowUpRight, X, CheckCircle2 } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useMock } from './model';
import { canEditReport } from '@/lib/mock-rules';

export function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) { return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action || <div className="date-chip"><CalendarDays size={14} /> Jumat, 9 Oktober 2026</div>}</div>; }
export function Panel({ title, subtitle, children, action, className = '' }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode; className?: string }) { return <section className={`panel ${className}`}><header className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>{children}</section>; }
export function Status({ status }: { status: string }) { const classes: Record<string, string> = { 'In Progress': 'progress', 'In Review': 'review', 'Done': 'done', 'Pending': 'pending', 'Disetujui': 'approved', 'Hadir': 'approved', 'Ditolak': 'rejected', 'Tidak Hadir': 'rejected', 'Izin': 'pending', 'Aktif': 'approved', 'Lupa Clock Out': 'pending' }; return <span className={`status ${classes[status] || ''}`}>{status === 'Hadir' && <span>●</span>}{status}</span>; }
export function SectionLink({ to, children }: { to: '/' | '/absensi' | '/task' | '/izin' | '/chat' | '/pengumuman'; children: ReactNode }) { return <Link className="text-action" to={to}>{children}<ArrowUpRight size={12} /></Link>; }
export function Feedback({ text, onClose }: { text: string; onClose: () => void }) { return <Dialog open={!!text} onOpenChange={onClose}><DialogContent><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="text-primary" size={21} /> Berhasil</DialogTitle><DialogDescription>{text}</DialogDescription><Button onClick={onClose}>Selesai</Button></DialogContent></Dialog>; }
export function ReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = useMock(); const [error, setError] = useState('');
  return <Dialog open={open} onOpenChange={onClose}><DialogContent><DialogTitle>Daily Report</DialogTitle><DialogDescription>Jumat, 9 Oktober 2026 · UI/UX Design</DialogDescription><form className="form-grid" onSubmit={e => { e.preventDefault(); if (!m.report.trim()) { setError('Isi laporan kegiatan terlebih dahulu.'); return; } m.setReportSent(true); onClose(); }}><label className="form-field">Kegiatan hari ini<textarea required placeholder="Tuliskan kegiatan, hasil pekerjaan, dan kendala hari ini…" value={m.report} onChange={e => m.setReport(e.target.value)} disabled={!canEditReport(!!m.clockOut)} /></label>{error && <p className="text-destructive text-xs">{error}</p>}{m.clockOut ? <p className="detail-copy">Laporan telah dikunci setelah clock out.</p> : <Button type="submit">{m.reportSent ? 'Simpan perubahan' : 'Kirim laporan'}</Button>}</form></DialogContent></Dialog>;
}