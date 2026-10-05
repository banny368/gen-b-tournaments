import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BarChart3, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  matches: number;
  wins: number;
  kills: number;
  points: number;
  earnings?: number;
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const t = await getTranslations("leaderboard");
  const { period = "global" } = await searchParams;
  const view = period === "weekly" ? "leaderboard_weekly" : period === "monthly" ? "leaderboard_monthly" : "leaderboard_global";

  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  const { data } = await supabase.from(view).select("*").order("points", { ascending: false }).limit(50);
  const rows = (data ?? []) as unknown as Row[];

  const tabs = [
    { key: "global", label: t("global") },
    { key: "monthly", label: t("monthly") },
    { key: "weekly", label: t("weekly") },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
      </div>

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/leaderboard?period=${tab.key}`}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors",
              period === tab.key ? "bg-primary text-white" : "border border-border text-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="pt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">{t("player")}</th>
                <th className="py-2 pr-2 text-right">{t("matches")}</th>
                <th className="py-2 pr-2 text-right">{t("wins")}</th>
                <th className="py-2 pr-2 text-right">{t("kills")}</th>
                <th className="py-2 text-right">{t("points")}</th>
                {period === "global" && <th className="py-2 text-right">{t("earnings")}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.user_id}
                  className={cn(
                    "border-t border-border/60",
                    user?.id === row.user_id && "bg-primary-soft/40",
                  )}
                >
                  <td className="py-2.5 pr-2 font-display font-bold">
                    {i === 0 ? <Crown className="size-4 text-warning" /> : i + 1}
                  </td>
                  <td className="py-2.5 pr-2 font-medium">
                    {row.display_name ?? row.username ?? "Player"}
                    {user?.id === row.user_id && <span className="ml-1.5 text-xs text-primary">({t("you")})</span>}
                  </td>
                  <td className="py-2.5 pr-2 text-right text-muted">{row.matches}</td>
                  <td className="py-2.5 pr-2 text-right">{row.wins}</td>
                  <td className="py-2.5 pr-2 text-right">{row.kills}</td>
                  <td className="py-2.5 text-right font-semibold">{row.points}</td>
                  {period === "global" && (
                    <td className="py-2.5 text-right font-semibold text-success">{formatINR(row.earnings ?? 0)}</td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
