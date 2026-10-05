import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminTournamentActions, CreateTournamentForm } from "@/components/admin/tournament-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGames } from "@/lib/supabase/queries";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminTournamentsPage() {
  const t = await getTranslations("admin");
  const tt = await getTranslations("tournament");
  const admin = createAdminClient();
  const games = await getGames();

  const { data } = await admin
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  const list = (data ?? []) as {
    id: string;
    title: string;
    status: string;
    entry_fee: number;
    prize_pool: number;
    current_players: number;
    max_players: number;
    match_start: string;
    payout_status: string;
  }[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("tournaments")}</h1>

      <CreateTournamentForm games={games} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("tournaments")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.map((tournament) => (
            <div key={tournament.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{tournament.title}</p>
                  <p className="text-xs text-muted">
                    {tt(`status.${tournament.status}`)} · {tournament.current_players}/{tournament.max_players} ·{" "}
                    {formatINR(tournament.entry_fee)} · {new Date(tournament.match_start).toLocaleString()}
                  </p>
                </div>
                <Badge variant={tournament.payout_status === "PAID" ? "success" : "muted"}>
                  {tournament.payout_status}
                </Badge>
              </div>
              <AdminTournamentActions tournament={tournament} />
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-muted">—</p>}
        </CardContent>
      </Card>
    </div>
  );
}
