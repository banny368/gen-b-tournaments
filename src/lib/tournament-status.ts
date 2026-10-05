import type { TournamentStatus } from "@/lib/types";

/**
 * TypeScript mirror of the SQL `effective_tournament_status()` (0004).
 * The DB function remains authoritative for joins/money; this mirror keeps
 * the UI consistent with server time so cards, countdowns and join gating
 * never contradict the backend.
 */
export function effectiveTournamentStatus(
  t: {
    status: TournamentStatus;
    registration_start: string | null;
    registration_end: string | null;
    match_start: string;
    estimated_end: string | null;
  },
  now: Date = new Date(),
): TournamentStatus {
  const nowMs = now.getTime();
  const startMs = t.registration_start ? Date.parse(t.registration_start) : Date.parse(t.match_start);
  const regEndMs = t.registration_end ? Date.parse(t.registration_end) : Date.parse(t.match_start);
  const matchMs = Date.parse(t.match_start);
  const endMs = t.estimated_end ? Date.parse(t.estimated_end) : null;

  if (t.status === "DRAFT") return "DRAFT";
  if (["CANCELLED", "REFUNDING", "REFUNDED", "COMPLETED", "DISPUTED"].includes(t.status)) return t.status;
  if (["ROOM_PENDING", "ROOM_RELEASED"].includes(t.status) && nowMs < matchMs) return t.status;
  if (["RESULT_PENDING", "RESULT_REVIEW"].includes(t.status)) return t.status;

  if (nowMs < startMs) return "SCHEDULED";
  if (nowMs < regEndMs) return "REGISTRATION_OPEN";
  if (nowMs < matchMs) return "REGISTRATION_CLOSED";
  if (endMs === null || nowMs < endMs) return "LIVE";
  return "RESULT_PENDING";
}
