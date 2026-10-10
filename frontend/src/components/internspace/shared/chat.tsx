import { useSearch } from "@tanstack/react-router";
import { Search, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatShortTime } from "@/lib/mock-rules";
import { type PageSearch } from "@/lib/search";
import { initials, useMock } from "@/components/internspace/shared/model";
import { Empty, PageHeading } from "@/components/internspace/shared/ui";

// ---------- Chat (semua role) ----------
export function ChatPage() {
  const m = useMock();
  const search = useSearch({ strict: false }) as PageSearch;
  const me = m.me.name;
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const mine = m.chats.filter((c) => c.from === me || c.to === me);
  const lastWith = (name: string) => mine.filter((c) => c.from === name || c.to === name).at(-1);
  const contacts = m.people
    .filter((p) => p.name !== me && p.name.toLowerCase().includes(query.toLowerCase()))
    .sort(
      (a, b) =>
        (lastWith(b.name)?.at ?? "").localeCompare(lastWith(a.name)?.at ?? "") ||
        a.name.localeCompare(b.name),
    );
  const [active, setActive] = useState<string>(search.to ?? contacts[0]?.name ?? "");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (search.to) setActive(search.to);
  }, [search.to]);
  useEffect(() => {
    if (!active) return;
    m.markChatRead(active);
    if (m.chatDraft?.to === active) {
      setMessage(m.chatDraft.text);
      m.setChatDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, m.chats.length]);
  const thread = mine.filter((c) => c.from === active || c.to === active);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [thread.length, active]);
  const unreadFrom = (name: string) =>
    mine.filter((c) => c.from === name && c.at > (m.chatRead[`${me}|${name}`] ?? "")).length;
  const person = m.person(active);
  return (
    <>
      <PageHeading
        title="Chat"
        subtitle="Semua pengguna dapat saling chat. Percakapan hanya dilihat pihak di dalamnya."
      />
      <section className="panel chat-layout">
        <div className="chat-contacts">
          <label className="search-field mb-2">
            <Search size={14} className="text-muted-foreground" />
            <input
              aria-label="Cari kontak"
              placeholder="Cari kontak"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {contacts.map((p) => {
            const last = lastWith(p.name);
            const unread = unreadFrom(p.name);
            return (
              <button
                key={p.id}
                type="button"
                className={`chat-contact ${active === p.name ? "active" : ""}`}
                onClick={() => setActive(p.name)}
              >
                <span className="avatar">{initials(p.name)}</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="flex justify-between gap-2">
                    <strong className="truncate">{p.name}</strong>
                    {unread > 0 && <span className="nav-count !ml-0">{unread}</span>}
                  </span>
                  <small className="truncate block">{last ? last.text : p.role}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className="chat-main">
          {!person ? (
            <Empty>Pilih kontak untuk mulai chat.</Empty>
          ) : (
            <>
              <div className="chat-header flex gap-3 items-center">
                <span className="avatar blue">{initials(person.name)}</span>
                <div>
                  {person.name}
                  <p className="text-[10px] text-muted-foreground mt-1 font-normal">
                    {person.role} · {person.title}
                  </p>
                </div>
              </div>
              <div className="chat-messages" ref={listRef}>
                {thread.length === 0 && <Empty>Belum ada pesan. Mulai percakapan.</Empty>}
                {thread.map((c) => (
                  <div key={c.id} className={`chat-bubble ${c.from === me ? "mine" : ""}`}>
                    {c.text}
                    <small>{formatShortTime(c.at)}</small>
                  </div>
                ))}
              </div>
              <form
                className="chat-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!message.trim()) return;
                  m.sendChat(person.name, message.trim());
                  setMessage("");
                }}
              >
                <input
                  aria-label="Tulis pesan"
                  placeholder="Tulis pesan..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button size="icon" type="submit" aria-label="Kirim pesan">
                  <Send />
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
      {m.role === "Admin" && (
        <p className="text-[11px] text-muted-foreground mt-3">
          Daftar chat hanya menampilkan percakapan milik Anda. Admin tidak dapat membaca chat orang
          lain.
        </p>
      )}
    </>
  );
}
