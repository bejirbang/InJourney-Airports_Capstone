import { useNavigate, useSearch } from "@tanstack/react-router";
import { Search, Send } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toMockRole } from "@/lib/api";
import type { ApiChatMessage } from "@/lib/endpoints/shared";
import { formatShortTime } from "@/lib/mock-rules";
import type { PageSearch } from "@/lib/search";
import { useAuth } from "@/lib/auth";
import {
  CHATS_KEY,
  appendChatMessage,
  applyChatRead,
  useChatContacts,
  useChatConversations,
  useChatMessages,
  useChatTyping,
  useMarkChatRead,
  useOnlineUsers,
  useSendChatMessage,
} from "@/components/internspace/shared/chat-data";
import { initials } from "@/components/internspace/shared/model";
import { Empty, PageHeading } from "@/components/internspace/shared/ui";
import { onUserEvent } from "@/lib/realtime";
import { useQueryClient } from "@tanstack/react-query";

// ---------- Chat (semua role) ----------
export function ChatPage() {
  const auth = useAuth();
  const meId = auth.user?.id ?? null;
  const apiRole = auth.user?.role ?? null;
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as PageSearch;
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [message, setMessage] = useState("");
  const [activeId, setActiveId] = useState<number | null>(() => {
    const id = Number(search.to);
    return Number.isInteger(id) && id > 0 ? id : null;
  });

  const conversations = useChatConversations(deferredQuery, meId !== null);
  const contacts = useChatContacts(deferredQuery, meId !== null);
  const firstConversationId = conversations.data?.conversations[0]?.partner.id ?? null;

  useEffect(() => {
    const id = Number(search.to);
    if (Number.isInteger(id) && id > 0) setActiveId(id);
  }, [search.to]);

  useEffect(() => {
    if (activeId === null && firstConversationId !== null) setActiveId(firstConversationId);
  }, [activeId, firstConversationId]);

  const messages = useChatMessages(activeId);
  const partner =
    messages.partner ??
    conversations.data?.conversations.find((item) => item.partner.id === activeId)?.partner ??
    contacts.data?.find((item) => item.id === activeId) ??
    null;

  const send = useSendChatMessage();
  const markRead = useMarkChatRead();
  const { mutate: markReadNow } = markRead;
  const { typing, notifyTyping } = useChatTyping(activeId, meId);
  const onlineUsers = useOnlineUsers();
  const online = partner ? onlineUsers.some((user) => user.id === partner.id) : false;

  const listRef = useRef<HTMLDivElement>(null);
  const lastRead = useRef<string | null>(null);

  // Pesan baru dan tanda dibaca datang dari WebSocket, bukan polling.
  useEffect(() => {
    if (meId === null || activeId === null) return;

    const offMessage = onUserEvent("chat.message", (payload) => {
      const { message: incoming } = payload as { message: ApiChatMessage };
      const belongs =
        (incoming.sender_id === meId && incoming.receiver_id === activeId) ||
        (incoming.sender_id === activeId && incoming.receiver_id === meId);

      if (belongs) appendChatMessage(queryClient, activeId, incoming);
      void queryClient.invalidateQueries({ queryKey: [...CHATS_KEY, "conversations"] });
    });

    const offRead = onUserEvent("chat.read", (payload) => {
      const event = payload as {
        reader_id: number;
        partner_id: number;
        last_read_id: number;
        read_at: string;
      };
      if (event.reader_id === activeId && event.partner_id === meId) {
        applyChatRead(queryClient, meId, activeId, event.last_read_id, event.read_at);
      }
    });

    return () => {
      offMessage();
      offRead();
    };
  }, [activeId, meId, queryClient]);

  // Membuka percakapan menandai pesan masuk sebagai dibaca.
  const lastIncomingId =
    messages.messages.filter((item) => item.receiver_id === meId).at(-1)?.id ?? null;
  useEffect(() => {
    if (activeId === null || lastIncomingId === null) return;
    const key = `${activeId}:${lastIncomingId}`;
    if (lastRead.current === key) return;
    lastRead.current = key;
    markReadNow(activeId);
  }, [activeId, lastIncomingId, markReadNow]);

  const lastMessageId = messages.messages.at(-1)?.id ?? null;
  const previousActive = useRef<number | null>(null);
  const previousLast = useRef<number | null>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const switched = previousActive.current !== activeId;
    const appended = lastMessageId !== null && lastMessageId !== previousLast.current;
    if (switched || appended) list.scrollTop = list.scrollHeight;
    previousActive.current = activeId;
    previousLast.current = lastMessageId;
  }, [activeId, lastMessageId]);

  const openPartner = (id: number) => {
    setActiveId(id);
    setMessage("");
    void navigate({ to: "/chat", search: { to: String(id) } as never });
  };

  const conversationList = conversations.data?.conversations ?? [];
  const newContacts = (contacts.data ?? []).filter(
    (person) => !conversationList.some((item) => item.partner.id === person.id),
  );

  const canSend = partner?.can_send === true;

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
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          {conversations.isLoading && <p className="empty">Memuat percakapan...</p>}
          {conversations.isError && (
            <p className="empty">
              {conversations.error instanceof Error
                ? conversations.error.message
                : "Percakapan gagal dimuat."}
            </p>
          )}
          {contacts.isError && (
            <p className="empty">
              {contacts.error instanceof Error ? contacts.error.message : "Kontak gagal dimuat."}
            </p>
          )}

          {conversationList.map((item) => (
            <button
              key={item.partner.id}
              type="button"
              className={`chat-contact ${activeId === item.partner.id ? "active" : ""}`}
              onClick={() => openPartner(item.partner.id)}
            >
              <span className="avatar">{initials(item.partner.name)}</span>
              <span className="min-w-0 flex-1 text-left">
                <span className="flex justify-between gap-2">
                  <strong className="truncate">{item.partner.name}</strong>
                  {item.unread_count > 0 && (
                    <span className="nav-count !ml-0">{item.unread_count}</span>
                  )}
                </span>
                <small className="truncate block">{item.last_message.body}</small>
              </span>
            </button>
          ))}

          {newContacts.length > 0 && (
            <p className="px-1 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Kontak
            </p>
          )}
          {newContacts.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`chat-contact ${activeId === person.id ? "active" : ""}`}
              onClick={() => openPartner(person.id)}
            >
              <span className="avatar">{initials(person.name)}</span>
              <span className="min-w-0 flex-1 text-left">
                <strong className="truncate block">{person.name}</strong>
                <small className="truncate block">{toMockRole[person.role]}</small>
              </span>
            </button>
          ))}

          {!conversations.isLoading &&
            !conversations.isError &&
            conversationList.length === 0 &&
            newContacts.length === 0 && <p className="empty">Belum ada kontak.</p>}
        </div>

        <div className="chat-main">
          {activeId === null ? (
            <Empty>Pilih kontak untuk mulai chat.</Empty>
          ) : messages.isLoading ? (
            <Empty>Memuat pesan...</Empty>
          ) : messages.isError ? (
            <Empty>
              {messages.error instanceof Error ? messages.error.message : "Pesan gagal dimuat."}
            </Empty>
          ) : !partner ? (
            <Empty>Kontak tidak ditemukan.</Empty>
          ) : (
            <>
              <div className="chat-header flex items-center gap-3">
                <span className="avatar blue">{initials(partner.name)}</span>
                <div>
                  <span className="flex items-center gap-2">
                    {partner.name}
                    <span
                      className={`online-dot ${online ? "" : "off"}`}
                      aria-label={online ? "Online" : "Offline"}
                      title={online ? "Online" : "Offline"}
                    />
                  </span>
                  <p className="mt-1 text-[10px] font-normal text-muted-foreground">
                    {toMockRole[partner.role]}
                    {partner.unit ? ` · ${partner.unit}` : ""}
                    {typing ? " · Mengetik..." : ""}
                  </p>
                </div>
              </div>

              <div className="chat-messages" ref={listRef}>
                {messages.hasNextPage && (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={messages.isFetchingNextPage}
                      onClick={() => void messages.fetchNextPage()}
                    >
                      {messages.isFetchingNextPage ? "Memuat..." : "Muat pesan lama"}
                    </Button>
                  </div>
                )}
                {messages.messages.length === 0 && (
                  <Empty>Belum ada pesan. Mulai percakapan.</Empty>
                )}
                {messages.messages.map((item) => (
                  <div
                    key={item.id}
                    className={`chat-bubble ${item.sender_id === meId ? "mine" : ""}`}
                  >
                    {item.body}
                    <small>
                      {formatShortTime(item.created_at ?? "")}
                      {item.sender_id === meId && item.read_at !== null ? " · Dibaca" : ""}
                    </small>
                  </div>
                ))}
              </div>

              {send.isError && (
                <p role="alert" className="px-4 pt-2 text-[11px] text-destructive">
                  {send.error instanceof Error ? send.error.message : "Pesan gagal dikirim."}
                </p>
              )}

              {canSend ? (
                <form
                  className="chat-compose"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const body = message.trim();
                    if (!body || send.isPending || activeId === null) return;
                    send.mutate({ partnerId: activeId, body }, { onSuccess: () => setMessage("") });
                  }}
                >
                  <input
                    aria-label="Tulis pesan"
                    placeholder="Tulis pesan..."
                    maxLength={2000}
                    value={message}
                    onChange={(event) => {
                      setMessage(event.target.value);
                      if (event.target.value.trim()) notifyTyping();
                    }}
                  />
                  <Button
                    size="icon"
                    type="submit"
                    aria-label="Kirim pesan"
                    disabled={send.isPending || message.trim() === ""}
                  >
                    <Send />
                  </Button>
                </form>
              ) : (
                <p className="chat-compose text-xs text-muted-foreground">Akun ini nonaktif.</p>
              )}
            </>
          )}
        </div>
      </section>
      {apiRole === "admin" && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Daftar chat hanya menampilkan percakapan milik Anda. Admin tidak dapat membaca chat orang
          lain.
        </p>
      )}
    </>
  );
}
