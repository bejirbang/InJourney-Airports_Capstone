// Endpoint bersama semua role: menu sidebar, notifikasi, chat, dan pengumuman (progress.md 4.1).
// Menu diisi di Fase 1 (progress.md 5.2); notifikasi/lonceng dan chat di Fase 5.
import { request, unwrap, type ApiRole } from "@/lib/api";

/** Satu item dari `GET /api/{role}/menu`. `path` server tidak dipakai (progress.md 4.3). */
export interface ApiMenuItem {
  key: string;
  path: string;
  /** Angka badge, atau `null` bila tidak ada. */
  badge: number | null;
}

export const menuApi = {
  list(token: string, role: ApiRole): Promise<ApiMenuItem[]> {
    return request<{ data?: ApiMenuItem[] }>(`/api/${role}/menu`, { token }).then(
      (body) => body.data ?? [],
    );
  },
};

// ---- Lonceng notifikasi (`Notification::toItem`) ----

export interface ApiNotificationItem {
  id: number;
  text: string;
  link_path: string;
  link_params: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string | null;
}

export interface ApiNotificationPage {
  data: ApiNotificationItem[];
  meta: {
    next_cursor: string | null;
    unread_count: number;
  };
}

export const notificationsApi = {
  list(token: string, cursor?: string | null): Promise<ApiNotificationPage> {
    const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return request<ApiNotificationPage>(`/api/notifications${suffix}`, { token });
  },

  read(token: string, id: number): Promise<{ data: ApiNotificationItem; unread_count: number }> {
    return request<{ data: ApiNotificationItem; meta: { unread_count: number } }>(
      `/api/notifications/${id}/read`,
      { method: "POST", token },
    ).then((body) => ({ data: body.data, unread_count: body.meta.unread_count }));
  },

  readAll(token: string): Promise<number> {
    return request<{ meta: { unread_count: number } }>("/api/notifications/read-all", {
      method: "POST",
      token,
    }).then((body) => body.meta.unread_count);
  },
};

// ---- Chat (`Chats::person`, `ChatMessage::toItem`) ----

export interface ApiChatPerson {
  id: number;
  name: string;
  role: ApiRole;
  unit: string | null;
  can_send: boolean;
}

export interface ApiChatMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  body: string;
  read_at: string | null;
  created_at: string | null;
}

export interface ApiChatConversation {
  partner: ApiChatPerson;
  last_message: ApiChatMessage;
  unread_count: number;
}

export interface ApiChatConversationList {
  conversations: ApiChatConversation[];
  unread_total: number;
}

export interface ApiChatMessagesPage {
  messages: ApiChatMessage[];
  partner: ApiChatPerson;
  has_more: boolean;
}

export const chatApi = {
  conversations(token: string, q?: string): Promise<ApiChatConversationList> {
    const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
    return request<{ data: ApiChatConversation[]; meta: { unread_total: number } }>(
      `/api/chats${suffix}`,
      { token },
    ).then((body) => ({
      conversations: body.data,
      unread_total: body.meta.unread_total,
    }));
  },

  contacts(token: string, q?: string): Promise<ApiChatPerson[]> {
    const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
    return request<{ data: ApiChatPerson[] }>(`/api/chats/contacts${suffix}`, { token }).then(
      (body) => body.data,
    );
  },

  messages(token: string, userId: number, beforeId?: number | null): Promise<ApiChatMessagesPage> {
    const suffix = beforeId ? `?before_id=${beforeId}` : "";
    return request<{
      data: ApiChatMessage[];
      meta: { partner: ApiChatPerson; has_more: boolean };
    }>(`/api/chats/${userId}/messages${suffix}`, { token }).then((body) => ({
      messages: body.data,
      partner: body.meta.partner,
      has_more: body.meta.has_more,
    }));
  },

  send(token: string, userId: number, body: string): Promise<ApiChatMessage> {
    return request<{ data: ApiChatMessage }>(`/api/chats/${userId}/messages`, {
      method: "POST",
      body: { body },
      token,
    }).then(unwrap<ApiChatMessage>);
  },

  read(token: string, userId: number): Promise<number> {
    return request<{ meta: { unread_total: number } }>(`/api/chats/${userId}/read`, {
      method: "POST",
      token,
    }).then((body) => body.meta.unread_total);
  },
};

// ---- Pengumuman saat notifikasi diklik ----

export interface ApiAnnouncement {
  id: number;
  title: string;
  body: string;
  author_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const announcementApi = {
  show(token: string, id: number): Promise<ApiAnnouncement> {
    return request<{ data: ApiAnnouncement }>(`/api/announcements/${id}`, { token }).then(
      unwrap<ApiAnnouncement>,
    );
  },
};
