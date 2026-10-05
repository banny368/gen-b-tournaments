import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DepositQueueActions } from "@/components/admin/deposit-queue-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDepositsPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();

  const { data } = await admin
    .from("deposits")
    .select("*, profiles (username, display_name)")
    .in("status", ["PENDING_REVIEW", "FLAGGED"])
    .order("submitted_at", { ascending: true })
    .limit(50);

  const list = (data ?? []) as unknown as {
    id: string;
    amount: number;
    provider: string;
    status: string;
    reference_code: string;
    utr: string | null;
    risk_score: number;
    created_at: string;
    profiles: { username: string | null; display_name: string | null } | null;
  }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("deposits")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pendingDeposits")} ({list.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.map((d) => (
            <div key={d.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold">{formatINR(d.amount)}</p>
                  <p className="text-xs text-muted">
                    {d.profiles?.display_name ?? d.profiles?.username} · {d.reference_code} · UTR{" "}
                    <span className="select-all font-mono">{d.utr ?? "—"}</span> · {d.provider}
                  </p>
                </div>
                <Badge variant={d.status === "FLAGGED" ? "danger" : "warning"}>{d.status}</Badge>
              </div>
              <DepositQueueActions depositId={d.id} />
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-muted">—</p>}
        </CardContent>
      </Card>
    </div>
  );
}
