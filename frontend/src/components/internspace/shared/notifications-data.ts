import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { internToken } from "@/lib/api";
import {
  notificationsApi,
  type ApiNotificationItem,
  type ApiNotificationPage,
} from "@/lib/endpoints/shared";
import { onUserEvent } from "@/lib/realtime";

// Lonceng notifikasi (progress.md 9.2). Daftar memakai cursor dari server;
// event WebSocket memperbarui cache tanpa polling.

export const NOTIFICATIONS_KEY = ["notifications"] as const;

type NotificationPages = InfiniteData<ApiNotificationPage, string | null>;

interface NotificationSentPayload {
  notification: ApiNotificationItem;
  unread_count: number;
}

interface NotificationsReadPayload {
  ids: number[] | null;
  unread_count: number;
}

interface NotificationsChangedPayload {
  unread_count: number;
}

function withUnreadCount(pages: NotificationPages, unreadCount: number): NotificationPages {
  return {
    ...pages,
    pages: pages.pages.map((page) => ({
      ...page,
      meta: { ...page.meta, unread_count: unreadCount },
    })),
  };
}

/** Daftar notifikasi terbaru + angka lonceng dari `meta.unread_count`. */
export function useNotifications(enabled = true) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: ({ pageParam }) => notificationsApi.list(internToken(), pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.next_cursor,
    enabled,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const offSent = onUserEvent("notification.sent", (payload) => {
      const { notification, unread_count } = payload as NotificationSentPayload;
      queryClient.setQueryData<NotificationPages>(NOTIFICATIONS_KEY, (old) => {
        if (!old) return old;
        const first = old.pages[0];
        if (!first) return withUnreadCount(old, unread_count);
        return {
          ...old,
          pages: [
            {
              ...first,
              data: [notification, ...first.data.filter((item) => item.id !== notification.id)],
              meta: { ...first.meta, unread_count },
            },
            ...old.pages.slice(1).map((page) => ({
              ...page,
              data: page.data.filter((item) => item.id !== notification.id),
              meta: { ...page.meta, unread_count },
            })),
          ],
        };
      });
    });

    const offRead = onUserEvent("notifications.read", (payload) => {
      const { ids, unread_count } = payload as NotificationsReadPayload;
      queryClient.setQueryData<NotificationPages>(NOTIFICATIONS_KEY, (old) => {
        if (!old) return old;
        const readAt = new Date().toISOString();
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((item) =>
              (ids === null || ids.includes(item.id)) && item.read_at === null
                ? { ...item, read_at: readAt }
                : item,
            ),
            meta: { ...page.meta, unread_count },
          })),
        };
      });
    });

    const offChanged = onUserEvent("notifications.changed", (payload) => {
      const { unread_count } = payload as NotificationsChangedPayload;
      queryClient.setQueryData<NotificationPages>(NOTIFICATIONS_KEY, (old) =>
        old ? withUnreadCount(old, unread_count) : old,
      );
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    });

    return () => {
      offSent();
      offRead();
      offChanged();
    };
  }, [queryClient]);

  const unreadCount = query.data?.pages[0]?.meta.unread_count ?? 0;
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];

  return { ...query, items, unreadCount };
}

/** Tandai satu notifikasi dibaca; angka lonceng mengikuti `meta.unread_count`. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notificationsApi.read(internToken(), id),
    onSuccess: (result) => {
      queryClient.setQueryData<NotificationPages>(NOTIFICATIONS_KEY, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((item) => (item.id === result.data.id ? result.data : item)),
            meta: { ...page.meta, unread_count: result.unread_count },
          })),
        };
      });
    },
  });
}

/** Tandai semua notifikasi dibaca. */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.readAll(internToken()),
    onSuccess: (unreadCount) => {
      queryClient.setQueryData<NotificationPages>(NOTIFICATIONS_KEY, (old) => {
        if (!old) return old;
        const readAt = new Date().toISOString();
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((item) =>
              item.read_at === null ? { ...item, read_at: readAt } : item,
            ),
            meta: { ...page.meta, unread_count: unreadCount },
          })),
        };
      });
    },
  });
}
