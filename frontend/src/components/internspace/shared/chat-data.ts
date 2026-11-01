import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { internToken } from "@/lib/api";
import {
  chatApi,
  type ApiChatConversationList,
  type ApiChatMessage,
  type ApiChatMessagesPage,
  type ApiChatPerson,
} from "@/lib/endpoints/shared";
import {
  getOnlineUsers,
  onPresence,
  onUserEvent,
  sendChatWhisper,
  subscribeChatWhisper,
  type OnlineUser,
} from "@/lib/realtime";

// Data chat (progress.md 9.3). Pesan baru masuk lewat WebSocket lalu ditambahkan
// ke cache; daftar percakapan disegarkan dari event, bukan polling.

export const CHATS_KEY = ["chats"] as const;
export const chatConversationsKey = (q: string) => [...CHATS_KEY, "conversations", q] as const;
export const chatContactsKey = (q: string) => [...CHATS_KEY, "contacts", q] as const;
export const chatMessagesKey = (partnerId: number) =>
  [...CHATS_KEY, "messages", partnerId] as const;
export const chatLiveUnreadKey = [...CHATS_KEY, "live-unread"] as const;
export const chatActivityKey = [...CHATS_KEY, "activity"] as const;

type MessagePages = InfiniteData<ApiChatMessagesPage, number | undefined>;
type ChatCounters = Record<number, number>;

/** Cadangan angka belum dibaca per lawan bicara saat daftar percakapan gagal dimuat. */
export function useChatLiveUnreadMap(): ChatCounters {
  const { data } = useQuery({
    queryKey: chatLiveUnreadKey,
    queryFn: () => ({} as ChatCounters),
    enabled: false,
    staleTime: Infinity,
    initialData: {},
  });
  return data ?? {};
}

/** Cadangan angka ikon chat saat daftar percakapan belum/gagal dimuat. */
export function useChatLiveUnread(): number {
  const byPartner = useChatLiveUnreadMap();
  return Object.values(byPartner).reduce((total, count) => total + count, 0);
}

/** Waktu pesan terakhir yang diketahui per lawan bicara, untuk urutan kontak. */
export function useChatActivity(): ChatCounters {
  const { data } = useQuery({
    queryKey: chatActivityKey,
    queryFn: () => ({} as ChatCounters),
    enabled: false,
    staleTime: Infinity,
    initialData: {},
  });
  return data ?? {};
}

function bumpChatActivity(queryClient: QueryClient, partnerId: number, messageId: number) {
  queryClient.setQueryData<ChatCounters>(chatActivityKey, (old) => {
    const next = { ...(old ?? {}) };
    if ((next[partnerId] ?? 0) < messageId) next[partnerId] = messageId;
    return next;
  });
}

function changeLiveUnread(queryClient: QueryClient, partnerId: number, delta: number) {
  queryClient.setQueryData<ChatCounters>(chatLiveUnreadKey, (old) => {
    const next = { ...(old ?? {}) };
    const value = (next[partnerId] ?? 0) + delta;
    if (value <= 0) delete next[partnerId];
    else next[partnerId] = value;
    return next;
  });
}

/** Daftar percakapan + total belum dibaca untuk ikon chat di header. */
export function useChatConversations(q = "", enabled = true) {
  return useQuery({
    queryKey: chatConversationsKey(q),
    queryFn: () => chatApi.conversations(internToken(), q || undefined),
    enabled,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Perbarui cache daftar percakapan dari event WebSocket. Dipakai satu tempat saja
 * (shell) agar pesan yang sama tidak dihitung dua kali.
 */
export function applyChatMessageToConversations(
  queryClient: QueryClient,
  meId: number,
  message: ApiChatMessage,
) {
  const incoming = message.receiver_id === meId;
  const partnerId = incoming ? message.sender_id : message.receiver_id;

  queryClient.setQueriesData<ApiChatConversationList>(
    { queryKey: [...CHATS_KEY, "conversations"] },
    (old) => {
      if (!old) return old;

      let found = false;
      let already = false;
      const conversations = old.conversations.map((item) => {
        if (item.partner.id !== partnerId) return item;
        found = true;
        already = item.last_message.id === message.id;
        if (already) return item;
        return {
          ...item,
          last_message: message,
          unread_count: incoming ? item.unread_count + 1 : item.unread_count,
        };
      });

      if (!found) {
        return {
          ...old,
          unread_total: incoming ? old.unread_total + 1 : old.unread_total,
        };
      }

      return {
        ...old,
        conversations,
        unread_total: incoming && !already ? old.unread_total + 1 : old.unread_total,
      };
    },
  );
}

/** Langganan event chat untuk badge header dan daftar percakapan. */
export function useChatRealtime(meId: number | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (meId === null) return;

    const offMessage = onUserEvent("chat.message", (payload) => {
      const { message } = payload as { message: ApiChatMessage };
      const incoming = message.receiver_id === meId;
      const partnerId = incoming ? message.sender_id : message.receiver_id;
      if (incoming) changeLiveUnread(queryClient, partnerId, 1);
      bumpChatActivity(queryClient, partnerId, message.id);
      applyChatMessageToConversations(queryClient, meId, message);
      void queryClient.invalidateQueries({ queryKey: [...CHATS_KEY, "conversations"] });
    });

    const offRead = onUserEvent("chat.read", (payload) => {
      const event = payload as {
        reader_id: number;
        partner_id: number;
      };
      if (event.reader_id === meId) {
        queryClient.setQueryData<ChatCounters>(chatLiveUnreadKey, (old) => {
          const next = { ...(old ?? {}) };
          delete next[event.partner_id];
          return next;
        });
        queryClient.setQueriesData<ApiChatConversationList>(
          { queryKey: [...CHATS_KEY, "conversations"] },
          (old) => {
            if (!old) return old;
            let removed = 0;
            const conversations = old.conversations.map((item) => {
              if (item.partner.id !== event.partner_id) return item;
              removed = item.unread_count;
              return { ...item, unread_count: 0 };
            });
            return {
              ...old,
              conversations,
              unread_total: Math.max(0, old.unread_total - removed),
            };
          },
        );
      }
      void queryClient.invalidateQueries({ queryKey: [...CHATS_KEY, "conversations"] });
    });

    return () => {
      offMessage();
      offRead();
    };
  }, [meId, queryClient]);
}

/** Kontak yang boleh dihubungi, ditampilkan di bawah percakapan. */
export function useChatContacts(q = "", enabled = true) {
  return useQuery({
    queryKey: chatContactsKey(q),
    queryFn: () => chatApi.contacts(internToken(), q || undefined),
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/** Riwayat pesan satu percakapan, 30 pesan per halaman dari server. */
export function useChatMessages(partnerId: number | null) {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: chatMessagesKey(partnerId ?? 0),
    queryFn: ({ pageParam }) => chatApi.messages(internToken(), partnerId as number, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.has_more ? last.messages[0]?.id : undefined),
    enabled: partnerId !== null && partnerId > 0,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const messages =
    query.data?.pages
      .slice()
      .reverse()
      .flatMap((page) => page.messages) ?? [];
  const partner: ApiChatPerson | null = query.data?.pages[0]?.partner ?? null;
  const lastMessageId = messages.at(-1)?.id ?? null;

  useEffect(() => {
    if (partnerId !== null && lastMessageId !== null) {
      bumpChatActivity(queryClient, partnerId, lastMessageId);
    }
  }, [lastMessageId, partnerId, queryClient]);

  return { ...query, messages, partner };
}

/** Tambahkan pesan ke cache percakapan aktif; id yang sama tidak diduplikasi. */
export function appendChatMessage(
  queryClient: QueryClient,
  partnerId: number,
  message: ApiChatMessage,
) {
  queryClient.setQueryData<MessagePages>(chatMessagesKey(partnerId), (old) => {
    if (!old) return old;
    if (old.pages.some((page) => page.messages.some((item) => item.id === message.id))) {
      return old;
    }
    const first = old.pages[0];
    if (!first) return old;
    return {
      ...old,
      pages: [{ ...first, messages: [...first.messages, message] }, ...old.pages.slice(1)],
    };
  });
}

/** Tandai pesan saya yang sudah dibaca lawan bicara (event `.chat.read`). */
export function applyChatRead(
  queryClient: QueryClient,
  meId: number,
  readerId: number,
  lastReadId: number,
  readAt: string,
) {
  queryClient.setQueriesData<MessagePages>({ queryKey: [...CHATS_KEY, "messages"] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        messages: page.messages.map((message) =>
          message.sender_id === meId &&
          message.receiver_id === readerId &&
          message.id <= lastReadId &&
          message.read_at === null
            ? { ...message, read_at: readAt }
            : message,
        ),
      })),
    };
  });
}

/** Kirim pesan; respons server langsung masuk cache percakapan tujuan. */
export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ partnerId, body }: { partnerId: number; body: string }) =>
      chatApi.send(internToken(), partnerId, body),
    onSuccess: (message, variables) => {
      const key = chatMessagesKey(variables.partnerId);
      if (queryClient.getQueryData(key)) {
        appendChatMessage(queryClient, variables.partnerId, message);
      } else {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      applyChatMessageToConversations(queryClient, message.sender_id, message);
      bumpChatActivity(queryClient, variables.partnerId, message.id);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...CHATS_KEY, "conversations"] });
    },
  });
}

/** Tandai percakapan dibaca; server juga menandai notifikasi chat terkait. */
export function useMarkChatRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (partnerId: number) => chatApi.read(internToken(), partnerId),
    onSuccess: (unreadTotal, partnerId) => {
      queryClient.setQueryData<ChatCounters>(chatLiveUnreadKey, (old) => {
        const next = { ...(old ?? {}) };
        delete next[partnerId];
        return next;
      });
      queryClient.setQueriesData<ApiChatConversationList>(
        { queryKey: [...CHATS_KEY, "conversations"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            unread_total: unreadTotal,
            conversations: old.conversations.map((item) =>
              item.partner.id === partnerId ? { ...item, unread_count: 0 } : item,
            ),
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: [...CHATS_KEY, "conversations"] });
    },
  });
}

/** Pengguna yang sedang online dari channel presence. */
export function useOnlineUsers(): OnlineUser[] {
  const [users, setUsers] = useState<OnlineUser[]>(() => getOnlineUsers());
  useEffect(() => onPresence(setUsers), []);
  return users;
}

/**
 * Indikator mengetik lewat whisper pada channel percakapan. Whisper dikirim
 * paling sering setiap 2 detik; indikator hilang sendiri setelah 3 detik.
 */
export function useChatTyping(partnerId: number | null, meId: number | null) {
  const [typing, setTyping] = useState(false);
  const timer = useRef<number | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    setTyping(false);
    lastSent.current = 0;
    if (partnerId === null || meId === null) return;
    const off = subscribeChatWhisper(meId, partnerId, () => {
      setTyping(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setTyping(false), 3_000);
    });
    return () => {
      off();
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [meId, partnerId]);

  const notifyTyping = useCallback(() => {
    if (partnerId === null || meId === null) return;
    const now = Date.now();
    if (now - lastSent.current < 2_000) return;
    lastSent.current = now;
    sendChatWhisper(meId, partnerId);
  }, [meId, partnerId]);

  return { typing, notifyTyping };
}
