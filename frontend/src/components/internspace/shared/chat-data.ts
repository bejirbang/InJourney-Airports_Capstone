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

type MessagePages = InfiniteData<ApiChatMessagesPage, number | undefined>;

/** Daftar percakapan + total belum dibaca untuk ikon chat di header. */
export function useChatConversations(q = "", enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: chatConversationsKey(q),
    queryFn: () => chatApi.conversations(internToken(), q || undefined),
    enabled,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: [...CHATS_KEY, "conversations"] });
    };
    const offMessage = onUserEvent("chat.message", refresh);
    const offRead = onUserEvent("chat.read", refresh);
    return () => {
      offMessage();
      offRead();
    };
  }, [queryClient]);

  return query;
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
      appendChatMessage(queryClient, variables.partnerId, message);
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
    onSuccess: () => {
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
