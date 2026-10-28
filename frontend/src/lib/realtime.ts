import type Echo from "laravel-echo";
import type Pusher from "pusher-js";
import { apiBaseUrl } from "@/lib/api";

// Koneksi Laravel Echo + Reverb (progress.md 9.1). Modul ini hanya menyentuh
// browser saat connectEcho dipanggil, jadi aman diimpor saat render server.
// Semua event real-time lewat WebSocket; tidak ada polling di latar belakang.

export type RealtimeUserEvent =
  | "notification.sent"
  | "notifications.read"
  | "notifications.changed"
  | "chat.message"
  | "chat.read";

export interface OnlineUser {
  id: number;
  name: string;
}

type UserListener = (payload: unknown) => void;
type PresenceListener = (users: OnlineUser[]) => void;
type ConnectionListener = () => void;

const USER_EVENTS: RealtimeUserEvent[] = [
  "notification.sent",
  "notifications.read",
  "notifications.changed",
  "chat.message",
  "chat.read",
];

const userListeners = new Map<RealtimeUserEvent, Set<UserListener>>();
const presenceListeners = new Set<PresenceListener>();
const connectionListeners = new Set<ConnectionListener>();

let echo: Echo<"reverb"> | null = null;
let connectedKey: string | null = null;
let connectPromise: Promise<void> | null = null;
let connectionEpoch = 0;
let online = new Map<number, OnlineUser>();

const appKey = import.meta.env["VITE_REVERB_APP_KEY"] as string | undefined;

/** Reverb hanya dipakai bila key diisi dan kode berjalan di browser. */
export function isRealtimeEnabled(): boolean {
  return Boolean(appKey) && typeof window !== "undefined";
}

function emitUserEvent(event: RealtimeUserEvent, payload: unknown) {
  for (const listener of userListeners.get(event) ?? []) listener(payload);
}

function notifyPresence() {
  const users = getOnlineUsers();
  for (const listener of presenceListeners) listener(users);
}

function notifyConnection() {
  for (const listener of connectionListeners) listener();
}

function setOnline(users: OnlineUser[]) {
  online = new Map(users.map((user) => [user.id, user]));
  notifyPresence();
}

function addOnline(user: OnlineUser) {
  online.set(user.id, user);
  notifyPresence();
}

function removeOnline(user: OnlineUser) {
  online.delete(user.id);
  notifyPresence();
}

/** Daftar pengguna yang sedang membuka aplikasi (channel presence `online`). */
export function getOnlineUsers(): OnlineUser[] {
  return [...online.values()];
}

/**
 * Sambungkan Echo untuk satu sesi. Dipanggil AuthProvider saat status `authed`.
 * Token yang sama tidak membuat koneksi baru.
 */
export async function connectEcho(token: string, userId: number): Promise<void> {
  if (!isRealtimeEnabled() || !appKey) return;

  const key = `${userId}:${token}`;
  if (connectedKey === key && echo) return;
  if (connectPromise) await connectPromise.catch(() => undefined);
  if (connectedKey === key && echo) return;

  disconnectEcho();
  const epoch = connectionEpoch;

  const current = (async () => {
    const [{ default: EchoCtor }, { default: PusherCtor }] = await Promise.all([
      import("laravel-echo"),
      import("pusher-js"),
    ]);
    // Logout/401 bisa terjadi saat modul dinamis masih dimuat.
    if (!isRealtimeEnabled() || epoch !== connectionEpoch) return;

    (window as unknown as { Pusher: typeof Pusher }).Pusher = PusherCtor;

    const scheme = (import.meta.env["VITE_REVERB_SCHEME"] as string | undefined) ?? "http";
    const port = Number((import.meta.env["VITE_REVERB_PORT"] as string | undefined) ?? 8080);
    const instance = new EchoCtor<"reverb">({
      broadcaster: "reverb",
      key: appKey,
      wsHost: (import.meta.env["VITE_REVERB_HOST"] as string | undefined) ?? "localhost",
      wsPort: port,
      wssPort: port,
      forceTLS: scheme === "https",
      enabledTransports: ["ws", "wss"],
      authEndpoint: `${apiBaseUrl}/api/broadcasting/auth`,
      auth: {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      },
    });

    echo = instance;
    connectedKey = key;

    const channel = instance.private(`users.${userId}`);
    for (const event of USER_EVENTS) {
      channel.listen(`.${event}`, (payload: unknown) => emitUserEvent(event, payload));
    }

    instance
      .join("online")
      .here((users: OnlineUser[]) => setOnline(users))
      .joining((user: OnlineUser) => addOnline(user))
      .leaving((user: OnlineUser) => removeOnline(user));

    notifyConnection();
  })();

  connectPromise = current;
  try {
    await current;
  } finally {
    if (connectPromise === current) connectPromise = null;
  }
}

/** Putuskan koneksi saat logout atau 401. */
export function disconnectEcho(): void {
  connectionEpoch += 1;
  if (echo) {
    try {
      echo.leave("online");
    } catch {
      // Koneksi sudah putus; tidak ada yang perlu dibersihkan.
    }
    try {
      echo.disconnect();
    } catch {
      // Sama seperti di atas.
    }
  }
  echo = null;
  connectedKey = null;
  connectPromise = null;
  online = new Map();
  notifyPresence();
  notifyConnection();
}

/** Dengarkan event pada channel `private users.{id}`. */
export function onUserEvent(event: RealtimeUserEvent, listener: UserListener): () => void {
  const listeners = userListeners.get(event) ?? new Set<UserListener>();
  listeners.add(listener);
  userListeners.set(event, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) userListeners.delete(event);
  };
}

/** Dengarkan daftar pengguna online; listener langsung dipanggil dengan nilai saat ini. */
export function onPresence(listener: PresenceListener): () => void {
  presenceListeners.add(listener);
  listener(getOnlineUsers());
  return () => {
    presenceListeners.delete(listener);
  };
}

function chatChannelName(meId: number, partnerId: number): string {
  return `chats.${Math.min(meId, partnerId)}.${Math.max(meId, partnerId)}`;
}

/**
 * Dengarkan whisper `typing` pada channel percakapan. Bila Echo belum siap,
 * langganan dipasang begitu koneksi tersedia.
 */
export function subscribeChatWhisper(
  meId: number,
  partnerId: number,
  onTyping: (userId: number) => void,
): () => void {
  const name = chatChannelName(meId, partnerId);
  let channel: ReturnType<Echo<"reverb">["private"]> | null = null;
  let boundTo: Echo<"reverb"> | null = null;

  const handler = (payload: unknown) => {
    const userId = (payload as { user_id?: unknown } | null)?.user_id;
    if (typeof userId === "number" && userId !== meId) onTyping(userId);
  };

  const bind = () => {
    if (!echo) {
      boundTo = null;
      channel = null;
      return;
    }
    if (boundTo === echo) return;
    boundTo = echo;
    channel = echo.private(name);
    channel.listenForWhisper("typing", handler);
  };

  bind();
  connectionListeners.add(bind);

  return () => {
    connectionListeners.delete(bind);
    if (channel) {
      try {
        channel.stopListeningForWhisper("typing", handler);
      } catch {
        // Channel sudah dilepas bersama koneksi.
      }
    }
    boundTo = null;
    channel = null;
  };
}

/** Kirim whisper mengetik; pemanggil yang membatasi frekuensi 2-3 detik. */
export function sendChatWhisper(meId: number, partnerId: number): void {
  if (!echo) return;
  try {
    echo.private(chatChannelName(meId, partnerId)).whisper("typing", { user_id: meId });
  } catch {
    // Koneksi sedang putus; indikator mengetik bersifat sementara.
  }
}
