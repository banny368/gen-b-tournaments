import { getTranslations } from "next-intl/server";
import { Gamepad2, Trophy } from "lucide-react";
import { Link } from "@/i18n/navigation";import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { Countdown } from "@/components/tournaments/countdown";
import {
  isSupabaseConfigured,
  getGames,
  getHomeTournaments,
} from "@/lib/supabase/queries";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tt = await getTranslations("tournament");
  const tc = await getTranslations("common");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={<Gamepad2 className="size-10" />}
        title="Backend setup required"
        description="Configure Supabase environment variables to load tournaments."
      />
    );
  }

  const [games, home] = await Promise.all([getGames(), getHomeTournaments()]);
  const serverNowIso = new Date().toISOString();
  const featured = home.featured ?? home.upcoming[0] ?? null;

  return (
    <div className="space-y-8">
      {/* ---------- hero / featured tournament ---------- */}
      {featured ? (
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-card border border-primary/25 bg-gradient-to-br from-primary-soft/80 via-surface to-surface p-6 shadow-card md:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{t("featured")}</Badge>
                <Badge variant="muted">{featured.games?.name}</Badge>
              </div>
              <h1 className="mt-3 font-display text-2xl font-bold leading-tight md:text-4xl">
                {featured.title}
              </h1>

              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted">{t("prizePool")}</p>
                  <p className="font-display text-xl font-bold text-success">{formatINR(featured.prize_pool)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted">{t("entryFee")}</p>
                  <p className="font-display text-xl font-bold">
                    {featured.entry_fee > 0 ? formatINR(featured.entry_fee) : tc("free")}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted">{tt("slots")}</p>
                  <p className="font-display text-xl font-bold">
                    {featured.current_players}/{featured.max_players}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted">{t("matchStarts")}</p>
                  <p className="font-display text-xl font-bold text-warning">
                    <Countdown targetIso={featured.match_start} serverNowIso={serverNowIso} />
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg" className="min-w-40">
                  <Link href={`/tournaments/${featured.slug}`}>{t("joinNow")}</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/tournaments">{tt("title")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------- game categories ---------- */}
      {games.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">{t("gameCategories")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {games.map((g) => (
              <Link
                key={g.id}
                href={`/tournaments?game=${g.id}`}
                className="group flex flex-col justify-between rounded-card border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
              >
                <div className="font-display text-xl font-bold text-gradient">{g.short_name}</div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{g.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- upcoming ---------- */}
      <TournamentSection
        title={t("upcoming")}
        href="/tournaments"
        tournaments={home.upcoming}
        serverNowIso={serverNowIso}
        emptyLabel={tt("noTournaments")}
      />

      {/* ---------- live ---------- */}
      {home.live.length > 0 && (
        <TournamentSection
          title={t("live")}
          href="/tournaments?status=LIVE"
          tournaments={home.live}
          serverNowIso={serverNowIso}
          emptyLabel={tt("noTournaments")}
        />
      )}

      {/* ---------- completed ---------- */}
      {home.completed.length > 0 && (
        <TournamentSection
          title={t("completed")}
          href="/tournaments?status=COMPLETED"
          tournaments={home.completed}
          serverNowIso={serverNowIso}
          emptyLabel={tt("noTournaments")}
        />
      )}
    </div>
  );
}

function TournamentSection({
  title,
  href,
  tournaments,
  serverNowIso,
  emptyLabel,
}: {
  title: string;
  href: string;
  tournaments: Awaited<ReturnType<typeof getHomeTournaments>>["upcoming"];
  serverNowIso: string;
  emptyLabel: string;
}) {
  if (tournaments.length === 0) return null;
  return (
    <section className="animate-fade-up">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Trophy className="size-4.5 text-primary" /> {title}
        </h2>
        <Link href={href} className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} serverNowIso={serverNowIso} />
        ))}
      </div>
      {tournaments.length === 0 && <EmptyState title={emptyLabel} />}
    </section>
  );
}
