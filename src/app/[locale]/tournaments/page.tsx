import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { FilterBar } from "@/components/tournaments/filter-bar";
import { getGames, getTournaments } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; status?: string; fee?: string; q?: string }>;
}) {
  const t = await getTranslations("tournament");
  const params = await searchParams;

  const games = await getGames();
  const tournaments = await getTournaments({
    gameId: params.game,
    status: params.status,
    maxFee: params.fee ? parseFloat(params.fee) : undefined,
    search: params.q,
  });
  const serverNowIso = new Date().toISOString();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Trophy className="size-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
      </div>

      <FilterBar games={games} current={{ game: params.game, status: params.status, q: params.q }} />

      {tournaments.length === 0 ? (
        <EmptyState icon={<Trophy className="size-10" />} title={t("noTournaments")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} serverNowIso={serverNowIso} />
          ))}
        </div>
      )}
    </div>
  );
}
