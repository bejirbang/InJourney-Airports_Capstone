import { useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  Columns3,
  ExternalLink,
  LayoutList,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TODAY,
  addDays,
  canComment,
  canDeleteTask,
  canDragTask,
  canEditTask,
  dueOnHoliday,
  formatDateTime,
  formatShort,
  formatShortTime,
  hoursBetween,
  internTaskAction,
  internTaskMove,
  lateLabel,
  mentorTaskMove,
  taskIsLate,
  taskStatuses,
  validateComment,
  validateRevise,
  validateSubmission,
  validateTask,
  type TaskStatus,
} from "@/lib/mock-rules";
import type { PageSearch } from "@/lib/search";
import { ME, shortName, useMock, type Task } from "./model";
import {
  Attachment,
  Confirm,
  Empty,
  FormError,
  Locked,
  PageHeading,
  Panel,
  Segmented,
  Status,
} from "./shared";

type Sort = "tenggat" | "terbaru" | "intern";

export function TasksPage() {
  const m = useMock();
  const search = useSearch({ strict: false }) as PageSearch;
  const isMentor = m.role === "Mentor";
  const myInterns = m.internsOf(ME.Mentor);
  const scope = m.tasks.filter((t) =>
    isMentor ? myInterns.some((p) => p.name === t.intern) : t.intern === ME.Intern,
  );

  const [view, setView] = useState<"kanban" | "daftar">("kanban");
  const [query, setQuery] = useState("");
  const [intern, setIntern] = useState("Semua");
  const [status, setStatus] = useState<"Semua" | TaskStatus>("Semua");
  const [onlyLate, setOnlyLate] = useState(false);
  const [sort, setSort] = useState<Sort>("tenggat");
  const [allDone, setAllDone] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [submitId, setSubmitId] = useState<string | null>(null);
  const [reviseId, setReviseId] = useState<string | null>(null);
  const [acceptId, setAcceptId] = useState<string | null>(null);
  const [formTask, setFormTask] = useState<Task | "new" | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  useEffect(() => {
    if (search.open) setOpenId(search.open);
  }, [search.open]);

  const filtered = scope
    .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
    .filter((t) => intern === "Semua" || t.intern === intern)
    .filter((t) => status === "Semua" || t.status === status)
    .filter((t) => !onlyLate || taskIsLate(t.due, t.status, t.submittedAt))
    .filter((t) => (!from || t.due.slice(0, 10) >= from) && (!to || t.due.slice(0, 10) <= to))
    .filter((t) => allDone || t.status !== "Done" || (t.doneAt ?? "") >= addDays(TODAY, -30))
    .sort((a, b) =>
      sort === "terbaru"
        ? b.createdAt.localeCompare(a.createdAt)
        : sort === "intern"
          ? a.intern.localeCompare(b.intern) || a.due.localeCompare(b.due)
          : a.due.localeCompare(b.due),
    );

  const update = (id: string, change: (t: Task) => Task) =>
    m.setTasks((old) => old.map((t) => (t.id === id ? change(t) : t)));

  const move = (task: Task, target: TaskStatus) => {
    const result = isMentor
      ? mentorTaskMove(task.status, target)
      : internTaskMove(task.status, target, task.everSubmitted);
    if (!result.ok) {
      if (result.message) toast.error(result.message);
      return;
    }
    if (result.action === "start") {
      update(task.id, (t) => ({ ...t, status: "In Progress" }));
      toast.success("Task mulai dikerjakan.");
    } else if (result.action === "back") {
      update(task.id, (t) => ({ ...t, status: "To Do" }));
      toast.success("Task kembali ke To Do.");
    } else if (result.action === "submit") setSubmitId(task.id);
    else if (result.action === "accept") setAcceptId(task.id);
    else if (result.action === "revise") setReviseId(task.id);
  };

  const card = (t: Task) => {
    const draggable = canDragTask(m.role, t.status);
    const late = taskIsLate(t.due, t.status, t.submittedAt);
    const unread = isMentor ? t.unread.Mentor : t.unread.Intern;
    const lockText = isMentor
      ? t.status === "Done"
        ? "Task sudah selesai."
        : "Status ini diubah oleh intern."
      : t.status === "In Review"
        ? "Task sedang diperiksa mentor."
        : "Task selesai terkunci.";
    return (
      <article
        key={t.id}
        className={`kanban-task ${draggable ? "draggable" : "locked-card"} ${dragId === t.id ? "dragging" : ""}`}
        draggable={draggable}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", t.id);
          setDragId(t.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverCol(null);
        }}
        onClick={() => setOpenId(t.id)}
        onKeyDown={(e) => e.key === "Enter" && setOpenId(t.id)}
        tabIndex={0}
        role="button"
        aria-label={`Buka ${t.title}`}
        title={draggable ? "Seret untuk memindah" : lockText}
      >
        <div className="flex items-start gap-2">
          <h3 className="flex-1">{t.title}</h3>
          {!draggable && <Locked text={lockText} />}
        </div>
        <p className="text-[10px] text-muted-foreground">{isMentor ? t.intern : t.mentor}</p>
        <div className="task-meta">
          <span>
            {t.status === "Done"
              ? `Selesai ${formatShort(t.doneAt ?? t.due)}`
              : `Tenggat ${formatShort(t.due)}`}
          </span>
          {late && <Status status="Terlambat" />}
          {unread > 0 && (
            <span className="comment-dot" aria-label={`${unread} komentar baru`}>
              <MessageSquare size={11} />
              {unread}
            </span>
          )}
        </div>
      </article>
    );
  };

  return (
    <>
      <PageHeading
        title="Task"
        subtitle={
          isMentor
            ? "Kelola dan periksa pekerjaan intern bimbingan."
            : "Pekerjaan dari mentor. Task berbeda dari Daily Report."
        }
        action={
          isMentor ? (
            <Button onClick={() => setFormTask("new")}>
              <Plus />
              Buat Task
            </Button>
          ) : undefined
        }
      />
      <div className="toolbar">
        <div className="flex flex-wrap gap-2 items-center">
          <Segmented
            label="Tampilan"
            value={view}
            onChange={setView}
            items={[
              {
                value: "kanban",
                label: (
                  <>
                    <Columns3 size={14} /> Kanban
                  </>
                ),
              },
              {
                value: "daftar",
                label: (
                  <>
                    <LayoutList size={14} /> Daftar
                  </>
                ),
              },
            ]}
          />
          <label className="search-field">
            <Search size={15} className="text-muted-foreground" />
            <input
              aria-label="Cari judul Task"
              placeholder="Cari judul"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {isMentor && (
            <select
              className="role-select"
              aria-label="Filter intern"
              value={intern}
              onChange={(e) => setIntern(e.target.value)}
            >
              <option value="Semua">Semua intern</option>
              {myInterns.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {view === "daftar" && (
            <select
              className="role-select"
              aria-label="Filter status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="Semua">Semua status</option>
              {taskStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
          <select
            className="role-select"
            aria-label="Filter tanda"
            value={onlyLate ? "late" : "all"}
            onChange={(e) => setOnlyLate(e.target.value === "late")}
          >
            <option value="all">Tanda: Semua</option>
            <option value="late">Hanya Terlambat</option>
          </select>
          <select
            className="role-select"
            aria-label="Urutkan"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="tenggat">Tenggat terdekat</option>
            <option value="terbaru">Terbaru dibuat</option>
            {isMentor && <option value="intern">Nama intern</option>}
          </select>
          {isMentor && (
            <span className="flex items-center gap-1 text-[11px]">
              Tenggat
              <input
                className="role-select"
                type="date"
                aria-label="Tenggat dari"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              s/d
              <input
                className="role-select"
                type="date"
                aria-label="Tenggat sampai"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </span>
          )}
          <label className="flex items-center gap-1 text-[11px]">
            <input
              type="checkbox"
              checked={allDone}
              onChange={(e) => setAllDone(e.target.checked)}
            />
            Semua Done
          </label>
        </div>
      </div>

      {scope.length === 0 ? (
        <Panel title="Task">
          <Empty>
            {isMentor ? "Belum ada Task untuk intern bimbingan." : "Belum ada Task dari mentor."}
          </Empty>
        </Panel>
      ) : view === "kanban" ? (
        <>
          <p className="text-[11px] text-muted-foreground mb-3">
            {isMentor
              ? "Hanya kartu In Review yang bisa diseret: ke Done (Accept) atau ke In Progress (Revise)."
              : "Seret kartu: To Do ke In Progress untuk mulai, In Progress ke In Review untuk mengumpulkan. Angka kecil = komentar baru."}
          </p>
          <div className="kanban">
            {taskStatuses.map((s) => {
              const items = filtered.filter((t) => t.status === s);
              return (
                <section
                  key={s}
                  className={`kanban-column ${overCol === s ? "drop-over" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverCol(s);
                  }}
                  onDragLeave={() => setOverCol(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain") || dragId;
                    const task = m.tasks.find((t) => t.id === id);
                    setOverCol(null);
                    setDragId(null);
                    if (task) move(task, s);
                  }}
                  aria-label={`Kolom ${s}`}
                >
                  <h2 className="kanban-heading">
                    <Status status={s} />
                    <span className="text-muted-foreground text-[10px]">{items.length}</span>
                  </h2>
                  {items.map(card)}
                  {s === "Done" && !allDone && (
                    <p className="text-[10px] text-muted-foreground">30 hari terakhir</p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <Panel title="Daftar Task" subtitle={`${filtered.length} Task`}>
          {filtered.length === 0 ? (
            <Empty>Tidak ada Task yang sesuai filter.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Judul</th>
                    <th>{isMentor ? "Intern" : "Mentor"}</th>
                    <th>Status</th>
                    <th>Tenggat</th>
                    <th>Tanda</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const unread = isMentor ? t.unread.Mentor : t.unread.Intern;
                    return (
                      <tr key={t.id}>
                        <td className="font-medium">{t.title}</td>
                        <td>{isMentor ? shortName(t.intern) : t.mentor}</td>
                        <td>
                          <Status status={t.status} />
                        </td>
                        <td>{formatShortTime(t.due)}</td>
                        <td className="flex gap-2">
                          {taskIsLate(t.due, t.status, t.submittedAt) && (
                            <Status status="Terlambat" />
                          )}
                          {unread > 0 && <span className="comment-dot">({unread}) baru</span>}
                        </td>
                        <td>
                          <Button size="sm" variant="outline" onClick={() => setOpenId(t.id)}>
                            {t.status === "Done"
                              ? "Lihat"
                              : isMentor && t.status === "In Review"
                                ? "Periksa"
                                : "Buka"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <TaskDetail
        task={scope.find((t) => t.id === openId) ?? null}
        onClose={() => setOpenId(null)}
        onSubmit={(id) => setSubmitId(id)}
        onRevise={(id) => setReviseId(id)}
        onAccept={(id) => setAcceptId(id)}
        onEdit={(t) => setFormTask(t)}
        update={update}
      />
      <SubmitDialog
        task={scope.find((t) => t.id === submitId) ?? null}
        onClose={() => setSubmitId(null)}
        update={update}
      />
      <ReviseDialog
        task={scope.find((t) => t.id === reviseId) ?? null}
        onClose={() => setReviseId(null)}
        update={update}
      />
      <AcceptDialog
        task={scope.find((t) => t.id === acceptId) ?? null}
        onClose={() => setAcceptId(null)}
        update={update}
      />
      {isMentor && <TaskForm task={formTask} onClose={() => setFormTask(null)} />}
    </>
  );
}

type Update = (id: string, change: (t: Task) => Task) => void;

function TaskDetail({
  task,
  onClose,
  onSubmit,
  onRevise,
  onAccept,
  onEdit,
  update,
}: {
  task: Task | null;
  onClose: () => void;
  onSubmit: (id: string) => void;
  onRevise: (id: string) => void;
  onAccept: (id: string) => void;
  onEdit: (t: Task) => void;
  update: Update;
}) {
  const m = useMock();
  const isMentor = m.role === "Mentor";
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  useEffect(() => {
    if (!task) return;
    setComment("");
    setError(null);
    const key = isMentor ? "Mentor" : "Intern";
    if (task.unread[key] > 0) update(task.id, (t) => ({ ...t, unread: { ...t.unread, [key]: 0 } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);
  if (!task) return <Dialog open={false} />;
  const late = taskIsLate(task.due, task.status, task.submittedAt);
  const internPerson = m.person(task.intern);
  const internInactive = !!internPerson && !m.isActive(internPerson);
  const action = internTaskAction(task.status);
  const sendComment = () => {
    const err = validateComment(comment);
    setError(err);
    if (err) return;
    const me = m.me.name;
    update(task.id, (t) => ({
      ...t,
      comments: [
        ...t.comments,
        { id: Date.now(), author: me, role: m.role, text: comment.trim(), at: m.nowIso() },
      ],
      unread: isMentor
        ? { ...t.unread, Intern: t.unread.Intern + 1 }
        : { ...t.unread, Mentor: t.unread.Mentor + 1 },
    }));
    if (isMentor) {
      if (task.intern === ME.Intern)
        m.notify("Intern", `${task.mentor} berkomentar di '${task.title}'.`, "/task", {
          open: task.id,
        });
    } else
      m.notify("Mentor", `${shortName(me)} membalas komentar di '${task.title}'.`, "/task", {
        open: task.id,
      });
    setComment("");
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 pr-6">
          <DialogTitle className="leading-snug">{task.title}</DialogTitle>
          <Status status={task.status} />
        </div>
        <DialogDescription asChild>
          <div className="task-detail-meta">
            <span>
              {isMentor ? "Intern" : "Mentor"}:{" "}
              <strong>{isMentor ? task.intern : task.mentor}</strong>
              {isMentor && internInactive && <Status status="Nonaktif" />}
            </span>
            <span>
              Tenggat: <strong>{formatDateTime(task.due)}</strong>{" "}
              {late && <Status status="Terlambat" />}{" "}
              {late && !task.submittedAt && task.status !== "Done" && (
                <em>{lateLabel(task.due)}</em>
              )}
            </span>
            {task.submittedAt && (
              <span>
                Dikumpulkan: {formatShortTime(task.submittedAt)}
                {task.submittedAt > task.due &&
                  ` (terlambat ${Math.round(hoursBetween(task.due, task.submittedAt))} jam)`}
              </span>
            )}
          </div>
        </DialogDescription>

        {isMentor && internInactive && (
          <div className="banner muted">
            Intern ini sudah nonaktif. Revise tidak dapat ditindaklanjuti intern.
          </div>
        )}
        {!isMentor && task.revisePending && task.status === "In Progress" && (
          <div className="banner warn">
            <AlertTriangle size={15} />
            Mentor meminta revisi. Lihat komentar di bawah.
          </div>
        )}

        <section className="detail-section">
          <h4>Deskripsi</h4>
          <p className="detail-copy">{task.description}</p>
        </section>

        <section className="detail-section">
          <h4>Hasil kumpulan</h4>
          {!task.link && !task.file ? (
            <p className="detail-copy">Belum ada hasil.</p>
          ) : (
            <div className="grid gap-2 text-xs">
              {task.link && (
                <span className="flex items-center gap-2">
                  Link:
                  <a
                    className="text-primary underline truncate"
                    href={task.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {task.link}
                  </a>
                  <ExternalLink size={12} />
                </span>
              )}
              {task.file && <Attachment name={task.file} />}
            </div>
          )}
          {!isMentor && action && task.status !== "To Do" && (
            <div className="flex justify-end mt-3">
              <Button onClick={() => onSubmit(task.id)}>{action}</Button>
            </div>
          )}
          {!isMentor && task.status === "To Do" && (
            <div className="flex justify-end mt-3">
              <Button
                onClick={() => {
                  update(task.id, (t) => ({ ...t, status: "In Progress" }));
                  toast.success("Task mulai dikerjakan.");
                }}
              >
                Mulai Kerjakan
              </Button>
            </div>
          )}
        </section>

        <section className="detail-section">
          <h4>Komentar</h4>
          {task.comments.length === 0 && <p className="detail-copy">Belum ada komentar.</p>}
          <ol className="thread">
            {task.comments.map((c) => (
              <li
                key={c.id}
                className={`${c.role === "Intern" ? "reply" : ""} ${c.revise ? "revise" : ""}`}
              >
                <div className="thread-head">
                  <strong>{c.author}</strong>
                  <small>{formatShortTime(c.at)}</small>
                  {c.revise && <Status status="Lupa Clock Out" label="Revisi" />}
                </div>
                <p>{c.text}</p>
              </li>
            ))}
          </ol>
          {canComment(task.status) ? (
            <form
              className="comment-form"
              onSubmit={(e) => {
                e.preventDefault();
                sendComment();
              }}
            >
              <input
                aria-label="Tulis komentar"
                placeholder="Tulis komentar..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button type="submit" size="sm">
                <Send />
                Kirim
              </Button>
            </form>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Thread terkunci karena Task sudah Done.
            </p>
          )}
          <FormError text={error} />
          <p className="text-[10px] text-muted-foreground mt-1">
            Komentar yang terkirim tidak dapat diedit atau dihapus.
          </p>
        </section>

        {isMentor && (
          <DialogFooter className="flex-wrap gap-2">
            {canEditTask(task.status) && (
              <Button variant="ghost" className="mr-auto" onClick={() => onEdit(task)}>
                <Pencil />
                Ubah
              </Button>
            )}
            {canDeleteTask(task.status, task.comments.length) && (
              <Button variant="ghost" className="text-destructive" onClick={() => setDel(true)}>
                <Trash2 />
                Hapus
              </Button>
            )}
            {task.status === "In Review" && (
              <>
                <Button variant="outline" onClick={() => onRevise(task.id)}>
                  Revise
                </Button>
                <Button onClick={() => onAccept(task.id)}>Accept</Button>
              </>
            )}
          </DialogFooter>
        )}
        <Confirm
          open={del}
          title="Hapus Task?"
          confirmLabel="Hapus Task"
          destructive
          onClose={() => setDel(false)}
          onConfirm={() => {
            m.setTasks((old) => old.filter((t) => t.id !== task.id));
            if (task.intern === ME.Intern)
              m.notify("Intern", `Task '${task.title}' dibatalkan mentor.`, "/task");
            setDel(false);
            onClose();
            toast.success("Task dihapus. Intern sudah diberi tahu.");
          }}
        >
          Task "{task.title}" untuk {task.intern} akan dihapus dan intern menerima notifikasi
          pembatalan. Hanya Task To Do tanpa komentar yang bisa dihapus.
        </Confirm>
      </DialogContent>
    </Dialog>
  );
}

function SubmitDialog({
  task,
  onClose,
  update,
}: {
  task: Task | null;
  onClose: () => void;
  update: Update;
}) {
  const m = useMock();
  const [link, setLink] = useState("");
  const [file, setFile] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLink("");
    setFile("");
    setError(null);
  }, [task?.id]);
  if (!task) return <Dialog open={false} />;
  const replacing = !!(task.link || task.file);
  const late = m.nowIso() > task.due;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Kumpulkan Hasil - {task.title}</DialogTitle>
        <DialogDescription>Isi link, file, atau keduanya.</DialogDescription>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            if (task.status === "Done") return setError("Task ini sudah selesai.");
            const err = validateSubmission(link, file);
            setError(err);
            if (err) return;
            const wasReview = task.status === "In Review";
            update(task.id, (t) => {
              const next: Task = {
                ...t,
                status: "In Review",
                everSubmitted: true,
                submittedAt: m.nowIso(),
                revisePending: false,
              };
              delete next.link;
              delete next.file;
              if (link.trim()) next.link = link.trim();
              if (file) next.file = file;
              return next;
            });
            m.notify(
              "Mentor",
              wasReview
                ? `${shortName(task.intern)} mengganti hasil Task '${task.title}'.`
                : `${shortName(task.intern)} mengumpulkan Task '${task.title}'.`,
              "/task",
              { open: task.id },
            );
            toast.success("Hasil terkumpul. Menunggu pemeriksaan mentor.");
            onClose();
          }}
        >
          <label className="form-field">
            Link hasil
            <input
              type="url"
              placeholder="https://"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </label>
          <label className="form-field">
            File hasil
            <input type="file" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
            <small className="text-muted-foreground">
              Jenis dan batas ukuran file ditetapkan tim backend (2 MB atau 10 MB, belum
              diputuskan).
            </small>
          </label>
          {replacing && (
            <div className="banner warn">
              Hasil sebelumnya akan diganti dan file lama dihapus permanen.
            </div>
          )}
          {late && (
            <div className="banner warn">
              Tenggat sudah lewat. Hasil tetap dapat dikumpulkan, mentor yang memutuskan.
            </div>
          )}
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">Kumpulkan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviseDialog({
  task,
  onClose,
  update,
}: {
  task: Task | null;
  onClose: () => void;
  update: Update;
}) {
  const m = useMock();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setText("");
    setError(null);
  }, [task?.id]);
  if (!task) return <Dialog open={false} />;
  const p = m.person(task.intern);
  const inactive = !!p && !m.isActive(p);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Revise Task - {task.title}</DialogTitle>
        <DialogDescription>
          Task akan kembali ke In Progress dan intern diberi tahu.
        </DialogDescription>
        {inactive && (
          <div className="banner warn">
            Intern sudah nonaktif dan tidak dapat menindaklanjuti revisi.
          </div>
        )}
        <label className="form-field">
          Komentar revisi *
          <textarea value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <FormError text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              const err = validateRevise(text);
              setError(err);
              if (err) return;
              update(task.id, (t) => ({
                ...t,
                status: "In Progress",
                revisions: t.revisions + 1,
                revisePending: true,
                unread: { ...t.unread, Intern: t.unread.Intern + 1 },
                comments: [
                  ...t.comments,
                  {
                    id: Date.now(),
                    author: ME.Mentor,
                    role: "Mentor",
                    text: text.trim(),
                    at: m.nowIso(),
                    revise: true,
                  },
                ],
              }));
              if (task.intern === ME.Intern)
                m.notify("Intern", `Task '${task.title}' perlu direvisi.`, "/task", {
                  open: task.id,
                });
              toast.success("Task dikembalikan ke intern untuk diperbaiki.");
              onClose();
            }}
          >
            Kirim Revisi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AcceptDialog({
  task,
  onClose,
  update,
}: {
  task: Task | null;
  onClose: () => void;
  update: Update;
}) {
  const m = useMock();
  const [text, setText] = useState("");
  if (!task) return null;
  return (
    <Confirm
      open
      title={`Accept Task - ${task.title}`}
      confirmLabel="Accept"
      onClose={() => {
        setText("");
        onClose();
      }}
      onConfirm={() => {
        update(task.id, (t) => ({
          ...t,
          status: "Done",
          doneAt: m.nowIso(),
          revisePending: false,
          comments: text.trim()
            ? [
                ...t.comments,
                {
                  id: Date.now(),
                  author: ME.Mentor,
                  role: "Mentor",
                  text: text.trim(),
                  at: m.nowIso(),
                },
              ]
            : t.comments,
        }));
        if (task.intern === ME.Intern)
          m.notify("Intern", `Task '${task.title}' diterima.`, "/task", { open: task.id });
        toast.success("Task diterima dan ditandai Done.");
        setText("");
        onClose();
      }}
    >
      <p>Task akan ditandai Done, terkunci, dan intern diberi tahu.</p>
      <label className="form-field mt-3">
        Komentar (opsional)
        <textarea className="!min-h-16" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
    </Confirm>
  );
}

function TaskForm({ task, onClose }: { task: Task | "new" | null; onClose: () => void }) {
  const m = useMock();
  const editing = task && task !== "new" ? task : null;
  const active = m.internsOf(ME.Mentor).filter((p) => m.isActive(p));
  const [intern, setIntern] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("17:00");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setIntern(editing?.intern ?? "");
    setTitle(editing?.title ?? "");
    setDescription(editing?.description ?? "");
    setDate(editing?.due.slice(0, 10) ?? "");
    setTime(editing?.due.slice(11, 16) ?? "17:00");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);
  const due = date ? `${date}T${time || "17:00"}` : "";
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{editing ? "Ubah Task" : "Buat Task"}</DialogTitle>
        <DialogDescription>
          Setiap Task diberikan ke satu intern. Perubahan memberi notifikasi ke intern.
        </DialogDescription>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const err = validateTask({ intern, title, description, due }, m.nowIso());
            setError(err);
            if (err) return;
            if (editing) {
              m.setTasks((old) =>
                old.map((t) =>
                  t.id === editing.id
                    ? { ...t, title: title.trim(), description: description.trim(), due }
                    : t,
                ),
              );
              if (editing.intern === ME.Intern)
                m.notify("Intern", `Task '${title.trim()}' diubah mentor.`, "/task", {
                  open: editing.id,
                });
              toast.success("Perubahan tersimpan.");
            } else {
              const id = `TSK-${String(Math.max(...m.tasks.map((t) => Number(t.id.slice(4)))) + 1).padStart(3, "0")}`;
              m.setTasks((old) => [
                ...old,
                {
                  id,
                  title: title.trim(),
                  description: description.trim(),
                  intern,
                  mentor: ME.Mentor,
                  due,
                  status: "To Do",
                  createdAt: m.nowIso(),
                  everSubmitted: false,
                  revisions: 0,
                  comments: [],
                  unread: { Intern: 0, Mentor: 0 },
                },
              ]);
              if (intern === ME.Intern)
                m.notify("Intern", `Task baru dari ${ME.Mentor}: ${title.trim()}.`, "/task", {
                  open: id,
                });
              toast.success("Task dibuat. Intern sudah diberi tahu.");
            }
            onClose();
          }}
        >
          <label className="form-field">
            Intern *
            <select value={intern} disabled={!!editing} onChange={(e) => setIntern(e.target.value)}>
              <option value="">Pilih intern</option>
              {active.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Judul *
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="form-field">
            Deskripsi *
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="form-two">
            <label className="form-field">
              Tenggat (tanggal) *
              <input
                type="date"
                value={date}
                min={TODAY}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="form-field">
              Jam
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          {dueOnHoliday(due, m.holidayDates) && (
            <p className="text-[11px] text-warning">
              Tenggat jatuh pada hari libur. Task tetap bisa disimpan.
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Lampiran referensi, prioritas, dan label belum termasuk versi ini.
          </p>
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
