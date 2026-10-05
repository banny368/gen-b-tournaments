import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { User, Shield, CalendarDays, Fingerprint } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { SignOutButton } from "@/components/profile/sign-out-button";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const tb = await getTranslations("leaderboard");
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);
  if (!profile) redirect("/login");

  const [privateRow, kyc, referrals] = await Promise.all([
    supabase.from("profile_private").select("date_of_birth, phone, state_code").eq("user_id", user.id).maybeSingle(),
    supabase.from("kyc_records").select("status").eq("user_id", user.id).maybeSingle(),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user.id),
  ]);

  const privateData = (privateRow.data ?? {}) as { date_of_birth: string | null; phone: string | null; state_code: string | null };
  const kycStatus = (kyc.data?.status as string) ?? "NOT_SUBMITTED";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="border-primary/25 bg-gradient-to-br from-primary-soft/60 via-surface to-surface">
        <CardContent className="flex items-center gap-5 pt-6">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent font-display text-2xl font-bold text-white shadow-glow">
            {(profile.display_name ?? profile.username ?? "P").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold">
                {profile.display_name ?? profile.username}
              </h1>
              {profile.is_verified && <Badge variant="success">Verified</Badge>}
              {kycStatus === "APPROVED" && <Badge variant="accent">KYC</Badge>}
            </div>
            <p className="text-sm text-muted">@{profile.username}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <Fingerprint className="size-3.5" /> {profile.player_code}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" /> {t("memberSince")}{" "}
                {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("referral")} value={String(referrals.count ?? 0)} />
        <StatCard
          label={t("kycStatus")}
          value={t(
            kycStatus === "NOT_SUBMITTED" ? "kycNotSubmitted"
            : kycStatus === "PENDING" ? "kycPending"
            : kycStatus === "APPROVED" ? "kycApproved"
            : "kycRejected",
          )}
        />
        <StatCard label={tb("matches")} value="0" />
        <StatCard label={tb("wins")} value="0" />
      </div>

      <ProfileEditForm
        profile={{
          display_name: profile.display_name,
          bio: profile.bio,
          language: profile.language,
          referral_code: profile.referral_code,
        }}
        privateData={{
          date_of_birth: privateData.date_of_birth,
          phone: privateData.phone,
          state_code: privateData.state_code,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="size-4.5 text-primary" /> {t("security")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted">{t("account")}</p>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
        <p className="mt-1 flex items-center gap-1.5 font-display text-lg font-bold">
          <User className="size-3.5 text-muted" />
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
