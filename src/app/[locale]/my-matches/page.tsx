import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Swords } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MyMatchesPage() {
  const t = await getTranslations("nav");
  const tt = await getTranslations("tournament");
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("tournament_entries")
    .select("id, slot_no, status, joined_at, tournaments (id, title, slug, status, match_start, entry_fee, prize_pool)")
    .order("joined_at", { ascending: false })
    .limit(50);
  const entries = (data ?? []) as unknown as {
    id: string;
    slot_no: number;
    status: string;
    joined_at: string;
    tournaments: { id: string; title: string; slug: string; status: string; match_start: string; entry_fee: number; prize_pool: number } | null;
  }[];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Swords className="size-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">{t("myMatches")}</h1>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Swords className="size-10" />}
          title={tt("noTournaments")}
          action={
            <Link href="/tournaments" className="text-sm font-medium text-primary hover:underline">
              {tt("title")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <Link key={e.id} href={`/tournaments/${e.tournaments?.slug ?? ""}`}>
              <Card className="mb-2 transition-colors hover:border-primary/40">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{e.tournaments?.title}</p>
                    <p className="text-xs text-muted">
                      #{e.slot_no} ·{" "}
                      {e.tournaments?.match_start
                        ? new Date(e.tournaments.match_start).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <Badge variant={e.tournaments?.status === "LIVE" ? "live" : "default"}>
                    {tt(`status.${e.tournaments?.status ?? "SCHEDULED"}`)}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
