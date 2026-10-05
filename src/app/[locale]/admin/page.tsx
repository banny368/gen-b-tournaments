import { getTranslations } from "next-intl/server";
import { Users, Trophy, ArrowDownToLine, ArrowUpFromLine, LifeBuoy, TrendingUp, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();

  const since30d = new Date(new Date().getTime() - 30 * 86400_000).toISOString();
  const [users, activeTournaments, pendingDeposits, pendingWithdrawals, openClaims, revenue, riskEvents] =
    await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin
        .from("tournaments")
        .select("id", { count: "exact", head: true })
        .in("status", ["SCHEDULED", "REGISTRATION_OPEN", "LIVE"]),
      admin.from("deposits").select("id", { count: "exact", head: true }).in("status", ["PENDING_REVIEW", "FLAGGED"]),
      admin.from("withdrawals").select("id", { count: "exact", head: true }).in("status", ["REQUESTED", "UNDER_REVIEW", "APPROVED"]),
      admin.from("claims").select("id", { count: "exact", head: true }).not("status", "in", "(RESOLVED,CLOSED,REJECTED)"),
      admin
        .from("ledger_entries")
        .select("amount")
        .eq("account", "PLATFORM_REVENUE")
        .eq("direction", "CREDIT")
        .gte("created_at", since30d),
      admin.from("risk_events").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
    ]);

  const revenue30d = (revenue.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  const stats = [
    { label: t("totalUsers"), value: users.count ?? 0, icon: Users, color: "text-primary" },
    { label: t("activeTournaments"), value: activeTournaments.count ?? 0, icon: Trophy, color: "text-accent" },
    { label: t("pendingDeposits"), value: pendingDeposits.count ?? 0, icon: ArrowDownToLine, color: "text-warning" },
    { label: t("pendingWithdrawals"), value: pendingWithdrawals.count ?? 0, icon: ArrowUpFromLine, color: "text-warning" },
    { label: t("openClaims"), value: openClaims.count ?? 0, icon: LifeBuoy, color: "text-danger" },
    { label: `${t("revenue")} (30d)`, value: formatINR(revenue30d), icon: TrendingUp, color: "text-success" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("dashboard")}</h1>

      <div className="rounded-card border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
        <ShieldAlert className="mr-2 inline size-4" />
        {t("complianceBanner")}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <Icon className={`size-5 ${color}`} />
              <p className="mt-3 font-display text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(riskEvents.count ?? 0) > 0 && (
        <Card className="border-danger/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-danger">
              <ShieldAlert className="size-4.5" /> Risk alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="danger">{riskEvents.count} open</Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
