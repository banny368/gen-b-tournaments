import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { CreateClanButton } from "@/components/clans/create-clan-button";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClansPage() {
  const t = await getTranslations("clans");
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [clans, myMembership] = await Promise.all([
    supabase.from("clans").select("*").eq("status", "ACTIVE").order("created_at").limit(30),
    supabase.from("clan_members").select("clan_id, role, status").eq("user_id", user.id).eq("status", "ACTIVE").maybeSingle(),
  ]);
  const clanList = (clans.data ?? []) as {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    member_limit: number;
  }[];
  const myClanId = myMembership.data?.clan_id as string | undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
        </div>
        {!myClanId && <CreateClanButton />}
      </div>

      {clanList.length === 0 ? (
        <EmptyState icon={<Users className="size-10" />} title={t("noClan")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {clanList.map((c) => (
            <Card key={c.id} className={c.id === myClanId ? "border-primary/40" : undefined}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-display text-base font-bold">
                    [{c.tag}] {c.name}
                  </p>
                  <p className="line-clamp-1 text-xs text-muted">{c.description ?? "—"}</p>
                </div>
                {c.id === myClanId ? (
                  <Badge variant="success">{t("myClan")}</Badge>
                ) : myClanId ? null : (
                  <Badge variant="muted">{t("join")}</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
