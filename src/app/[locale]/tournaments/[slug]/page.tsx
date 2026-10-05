import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Users, Trophy, MapPin, Clock, Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Countdown } from "@/components/tournaments/countdown";
import { JoinButton } from "@/components/tournaments/join-button";
import { RoomCredentials } from "@/components/tournaments/room-credentials";
import { getCurrentUser } from "@/lib/auth";
import { getTournamentBySlugOrId } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("tournament");
  const th = await getTranslations("home");
  const tournament = await getTournamentBySlugOrId(slug);
  if (!tournament) notFound();

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const serverNowIso = new Date().toISOString();

  const [participants, myEntry, results] = await Promise.all([
    supabase
      .from("tournament_entries")
      .select("id, slot_no, user_id, profiles (username, display_name, avatar_url)")
      .eq("tournament_id", tournament.id)
      .order("slot_no")
      .limit(100),
    user
      ? supabase
          .from("tournament_entries")
          .select("id")
          .eq("tournament_id", tournament.id)
          .eq("user_id", user.id)
          .eq("status", "ACTIVE")
          .maybeSingle()
      : Promise.resolve({ data: null } as const),
    tournament.status === "COMPLETED"
      ? supabase
          .from("tournament_results")
          .select("placement, kills, points, user_id, profiles (username, display_name)")
          .eq("tournament_id", tournament.id)
          .order("placement")
          .limit(20)
      : Promise.resolve({ data: [] } as const),
  ]);

  const slotsLeft = tournament.max_players - tournament.current_players;
  const canJoin =
    (tournament.status === "REGISTRATION_OPEN" || tournament.status === "SCHEDULED") && slotsLeft > 0;
  const alreadyJoined = Boolean(myEntry?.data);
  const isCompleted = tournament.status === "COMPLETED";

  const prizeList = [...tournament.prize_distribution]
    .filter((d) => typeof d.percent === "number")
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* header */}
      <div className="relative overflow-hidden rounded-card border border-border bg-gradient-to-br from-primary-soft/60 via-surface to-surface p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tournament.status === "LIVE" ? "live" : "default"}>
            {t(`status.${tournament.status}`)}
          </Badge>
          <Badge variant="muted">{tournament.games?.name}</Badge>
          <Badge variant="muted">{tournament.format.replace(/_/g, " ")}</Badge>
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold md:text-3xl">{tournament.title}</h1>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t("prizePool")} value={formatINR(tournament.prize_pool)} accent="text-success" />
          <Stat
            label={t("entryFee")}
            value={tournament.entry_fee > 0 ? formatINR(tournament.entry_fee) : "FREE"}
            accent="text-accent"
          />
          <Stat
            label={t("slots")}
            value={`${slotsLeft > 0 ? t("slotsLeft", { count: slotsLeft }) : t("full")}`}
          />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">
              {tournament.status === "COMPLETED" ? t("results") : th("matchStarts")}
            </p>
            {isCompleted ? (
              <p className="text-sm">{new Date(tournament.match_start).toLocaleString()}</p>
            ) : (
              <p className="font-display text-xl font-bold text-warning">
                <Countdown targetIso={tournament.match_start} serverNowIso={serverNowIso} />
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-5 lg:col-span-2">
          {tournament.description && (
            <Card>
              <CardHeader>
                <CardTitle>{tournament.title}</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-line text-sm text-muted">
                {tournament.description}
              </CardContent>
            </Card>
          )}

          {tournament.rules && (
            <Card>
              <CardHeader>
                <CardTitle>{t("rules")}</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-line text-sm text-muted">{tournament.rules}</CardContent>
            </Card>
          )}

          {prizeList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="size-4.5 text-warning" /> {t("prizePool")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {prizeList.map((d) => (
                    <li key={d.rank} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-surface-2 font-display text-xs font-bold">
                          {d.rank}
                        </span>
                        {t("rank")} {d.rank}
                      </span>
                      <span className="font-semibold text-success">
                        {formatINR((tournament.prize_pool * d.percent) / 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* participants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4.5 text-primary" /> {t("participants")} ({tournament.current_players}/
                {tournament.max_players})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {participants.data && participants.data.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(participants.data as unknown as { id: string; slot_no: number; profiles: { username: string | null; display_name: string | null } | null }[]).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2">
                      <span className="text-xs font-semibold text-muted">#{p.slot_no}</span>
                      <span className="truncate text-sm">
                        {p.profiles?.display_name ?? p.profiles?.username ?? "Player"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">—</p>
              )}
            </CardContent>
          </Card>

          {/* results */}
          {isCompleted && results.data && results.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("results")}</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted">
                      <th className="pb-2">{t("rank")}</th>
                      <th className="pb-2">{t("winner")}</th>
                      <th className="pb-2 text-right">{t("kills")}</th>
                      <th className="pb-2 text-right">{t("points")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(results.data as unknown as { id?: string; placement: number; kills: number; points: number; profiles: { username: string | null; display_name: string | null } | null }[]).map((r) => (
                      <tr key={r.placement} className="border-t border-border/60">
                        <td className="py-2 font-display font-bold">#{r.placement}</td>
                        <td className="py-2">{r.profiles?.display_name ?? r.profiles?.username ?? "—"}</td>
                        <td className="py-2 text-right">{r.kills ?? "—"}</td>
                        <td className="py-2 text-right font-semibold">{r.points ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* sidebar column */}
        <div className="space-y-5">
          <Card>
            <CardContent className="pt-5">
              <JoinButton
                tournamentId={tournament.id}
                entryFee={tournament.entry_fee}
                alreadyJoined={alreadyJoined}
                canJoin={canJoin}
              />
              {alreadyJoined && <RoomCredentials tournamentId={tournament.id} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("details")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row icon={<Gamepad2 className="size-4" />} label="Game" value={tournament.games?.name ?? "—"} />
              <Row icon={<Clock className="size-4" />} label={t("matchStarts")} value={new Date(tournament.match_start).toLocaleString()} />
              <Row icon={<Users className="size-4" />} label={t("teamSize")} value={`${tournament.team_size}`} />
              <Row icon={<MapPin className="size-4" />} label={t("mode")} value={tournament.format.replace(/_/g, " ")} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`font-display text-xl font-bold ${accent ?? ""}`}>{value}</p>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted">
        {icon} {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
