"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Users, Trophy, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "./countdown";
import { formatINR, cn } from "@/lib/utils";
import type { Tournament } from "@/lib/types";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "live" | "muted" | "accent"> = {
  SCHEDULED: "muted",
  REGISTRATION_OPEN: "success",
  REGISTRATION_CLOSED: "warning",
  ROOM_RELEASED: "accent",
  LIVE: "live",
  RESULT_PENDING: "muted",
  COMPLETED: "muted",
  CANCELLED: "danger",
  REFUNDED: "danger",
};

export function TournamentCard({
  tournament,
  serverNowIso,
}: {
  tournament: Tournament;
  serverNowIso: string;
}) {
  const t = useTranslations("tournament");
  const th = useTranslations("home");
  const tc = tournament;
  const slotsLeft = tc.max_players - tc.current_players;
  const isLive = tc.status === "LIVE";

  return (
    <Link href={`/tournaments/${tc.slug}`} className="group block">
      <article
        className={cn(
          "relative overflow-hidden rounded-card border border-border bg-surface shadow-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-glow",
          isLive && "border-live/40",
        )}
      >
        {/* banner */}
        <div className="relative h-32 bg-gradient-to-br from-primary-soft via-surface-2 to-surface">
          {tc.thumbnail_url || tc.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tc.thumbnail_url ?? tc.banner_url ?? ""}
              alt=""
              className="h-full w-full object-cover opacity-90"
            />
          ) : (
            <div className="flex h-full items-center justify-between px-5">
              <div className="font-display text-3xl font-bold text-gradient opacity-70">
                {tc.games?.short_name ?? "GB"}
              </div>
              <Trophy className="size-10 text-primary/20" />
            </div>
          )}
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge variant={statusVariant[tc.status] ?? "muted"}>{t(`status.${tc.status}`)}</Badge>
            {tc.is_demo && <Badge variant="accent">DEMO</Badge>}
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <h3 className="line-clamp-1 font-display text-base font-semibold">{tc.title}</h3>
            <p className="text-xs text-muted">{tc.games?.name}</p>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted">{t("prizePool")}</p>
              <p className="font-display text-lg font-bold text-success">{formatINR(tc.prize_pool)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted">{t("entryFee")}</p>
              <p className="font-display text-lg font-bold">
                {tc.entry_fee > 0 ? formatINR(tc.entry_fee) : <span className="text-accent">{th("joinNow")}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              {tc.current_players}/{tc.max_players}
            </span>
            {slotsLeft <= 0 ? (
              <span className="font-semibold text-danger">{t("full")}</span>
            ) : isLive ? (
              <span className="flex items-center gap-1.5 font-semibold text-live">
                <span className="size-1.5 animate-pulse-live rounded-full bg-live" /> {t("status.LIVE")}
              </span>
            ) : tc.status === "REGISTRATION_OPEN" || tc.status === "SCHEDULED" ? (
              <span className="flex items-center gap-1.5">
                <Zap className="size-3.5 text-warning" />
                <Countdown targetIso={tc.match_start} serverNowIso={serverNowIso} className="font-semibold text-warning" />
              </span>
            ) : (
              <span>{new Date(tc.match_start).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
