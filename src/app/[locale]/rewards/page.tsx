import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Gift, Users, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RewardClaimButton } from "@/components/rewards/reward-claim-button";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const t = await getTranslations("rewards");
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);
  if (!profile) redirect("/login");

  const [campaigns, referralCount] = await Promise.all([
    supabase.from("reward_campaigns").select("*").eq("active", true).order("created_at"),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user.id),
  ]);
  const campaignList = (campaigns.data ?? []) as {
    id: string;
    name: string;
    source: string;
    config: { amount?: number; target_account?: string };
  }[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Gift className="size-6 text-accent" />
        <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* daily login */}
      {campaignList
        .filter((c) => c.source === "DAILY_LOGIN")
        .map((c) => (
          <Card key={c.id} className="border-warning/30 bg-gradient-to-br from-warning/5 via-surface to-surface">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div>
                <CardTitle className="flex items-center gap-2 font-display text-lg font-bold">
                  <Sparkles className="size-5 text-warning" /> {t("dailyLogin")}
                </CardTitle>
                <p className="mt-1 text-sm text-muted">+₹{c.config.amount} · {t("claim")}</p>
              </div>
              <RewardClaimButton campaignId={c.id} label={t("claim")} />
            </CardContent>
          </Card>
        ))}

      {/* demo credits */}
      {campaignList
        .filter((c) => c.source === "ADMIN_GRANT")
        .map((c) => (
          <Card key={c.id} className="border-accent/30">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div>
                <CardTitle className="font-display text-lg font-bold">{t("demoCredits")}</CardTitle>
                <p className="mt-1 text-sm text-muted">{t("demoCreditsDesc")}</p>
              </div>
              <RewardClaimButton campaignId={c.id} label={t("claim")} variant="accent" />
            </CardContent>
          </Card>
        ))}

      {/* referral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg font-bold">
            <Users className="size-5 text-primary" /> {t("referral")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
            <div>
              <p className="text-xs text-muted">{t("yourCode")}</p>
              <p className="select-all font-display text-xl font-bold tracking-widest text-accent">
                {profile.referral_code}
              </p>
            </div>
            <Badge variant="accent">
              {t("friendsJoined")}: {referralCount.count ?? 0}
            </Badge>
          </div>
          <p className="text-sm text-muted">{t("referralRules")}</p>
        </CardContent>
      </Card>

      {/* rewarded ads — disabled pending policy verification */}
      <Card className="opacity-60">
        <CardContent className="pt-6">
          <CardTitle className="font-display text-lg font-bold">{t("adReward")}</CardTitle>
          <p className="mt-1 text-sm text-muted">{t("adRewardDisabled")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
