import { useQuery } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { mentorApi, type MentorInternFilter } from "@/lib/endpoints/mentor";
import { MENTOR_KEY } from "@/components/internspace/mentor/dashboard-data";

// Intern bimbingan (design-mentor.md Alur 3): daftar, identitas, dan data setiap tab detail.

export const INTERNS_KEY = [...MENTOR_KEY, "interns"] as const;

const numeric = (id: string | null) => (id === null ? 0 : Number(id));
const validId = (id: string | null) =>
  id !== null && Number.isInteger(Number(id)) && Number(id) > 0;

export function useMentorInterns(status: MentorInternFilter, q: string) {
  return useQuery({
    queryKey: [...INTERNS_KEY, "list", status, q],
    queryFn: () => mentorApi.interns(internToken(), { status, q }),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useMentorInternDetail(id: string | null) {
  return useQuery({
    queryKey: [...INTERNS_KEY, "detail", id ?? ""],
    queryFn: () => mentorApi.intern(internToken(), numeric(id)),
    enabled: validId(id),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useMentorInternAttendance(id: string | null, month: string | undefined) {
  return useQuery({
    queryKey: [...INTERNS_KEY, "attendance", id ?? "", month ?? ""],
    queryFn: () =>
      mentorApi.attendance(internToken(), numeric(id), month === undefined ? {} : { month }),
    enabled: validId(id) && month !== undefined,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useMentorAttendanceDay(id: string | null, date: string | null) {
  return useQuery({
    queryKey: [...INTERNS_KEY, "attendance-day", id ?? "", date ?? ""],
    queryFn: () => mentorApi.attendanceDay(internToken(), numeric(id), date ?? ""),
    enabled: validId(id) && date !== null,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useMentorInternLogbooks(id: string | null, month: string | undefined) {
  return useQuery({
    queryKey: [...INTERNS_KEY, "logbooks", id ?? "", month ?? ""],
    queryFn: () =>
      mentorApi.internLogbooks(internToken(), numeric(id), month === undefined ? {} : { month }),
    enabled: validId(id) && month !== undefined,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useMentorInternLeaves(id: string | null) {
  return useQuery({
    queryKey: [...INTERNS_KEY, "leaves", id ?? ""],
    queryFn: () => mentorApi.internLeaves(internToken(), numeric(id)),
    enabled: validId(id),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useMentorInternCorrections(id: string | null) {
  return useQuery({
    queryKey: [...INTERNS_KEY, "corrections", id ?? ""],
    queryFn: () => mentorApi.internCorrections(internToken(), numeric(id)),
    enabled: validId(id),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useMentorInternWarnings(id: string | null) {
  return useQuery({
    queryKey: [...INTERNS_KEY, "warnings", id ?? ""],
    queryFn: () => mentorApi.internWarnings(internToken(), numeric(id)),
    enabled: validId(id),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
