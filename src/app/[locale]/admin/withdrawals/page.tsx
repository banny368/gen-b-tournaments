import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WithdrawalQueueActions } from "@/components/admin/withdrawal-queue-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawalsPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();

  const { data } = await admin
    .from("withdrawals")
    .select("*, profiles (username, display_name)")
    .in("status", ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"])
    .order("created_at", { ascending: true })
    .limit(50);

  const list = (data ?? []) as unknown as {
    id: string;
    amount: number;
    fee: number;
    net_amount: number;
    destination_type: string;
    destination_details: { upi_id?: string };
    status: string;
    created_at: string;
    profiles: { username: string | null; display_name: string | null } | null;
  }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("withdrawals")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pendingWithdrawals")} ({list.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.map((w) => (
            <div key={w.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold">
                    {formatINR(w.amount)} <span className="text-sm font-normal text-muted">→ {formatINR(w.net_amount)}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {w.profiles?.display_name ?? w.profiles?.username} · {w.destination_type}{" "}
                    <span className="select-all font-mono">{w.destination_details?.upi_id ?? "—"}</span> · fee{" "}
                    {formatINR(w.fee)}
                  </p>
                </div>
                <Badge variant="warning">{w.status}</Badge>
              </div>
              <WithdrawalQueueActions withdrawalId={w.id} status={w.status} />
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-muted">—</p>}
        </CardContent>
      </Card>
    </div>
  );
}
