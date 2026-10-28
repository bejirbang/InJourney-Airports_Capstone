import { ApiError } from "@/lib/api";

/** Tanggal hari ini menurut browser, format `YYYY-MM-DD`. */
export const todayIso = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Satu pesan galat validasi pertama, atau pesan server apa adanya. */
export const errorText = (error: unknown, fallback: string): string => {
  if (!(error instanceof ApiError)) return fallback;
  const field = error.fields ? Object.values(error.fields)[0]?.[0] : undefined;
  return field ?? error.message;
};
