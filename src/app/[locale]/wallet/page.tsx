import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Wallet, PlusCircle, ArrowUpRight, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DepositDialog } from "@/components/wallet/deposit-dialog";
import { WithdrawDialog } from "@/components/wallet/withdraw-dialog";
import { getCurrentUser } from "@/lib/auth";
import {
  getWalletBalances,
  walletTotal,
} from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";
import type { BalanceAccount, LedgerEntry, Deposit, Withdrawal } from "@/lib/types";

export const dynamic = "force-dynamic";

const balanceAccounts: { key: BalanceAccount; labelKey: string; color: string }[] = [
  { key: "DEPOSIT", labelKey: "deposited", color: "text-foreground" },
  { key: "WINNINGS", labelKey: "winnings", color: "text-success" },
  { key: "BONUS", labelKey: "bonus", color: "text-warning" },
  { key: "REWARD", labelKey: "reward", color: "text-accent" },
  { key: "REFUND", labelKey: "refund", color: "text-foreground" },
];

export default async function WalletPage() {
  const t = await getTranslations("wallet");
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [balances, entries, deposits, withdrawals] = await Promise.all([
    getWalletBalances(user.id),
    supabase
      .from("ledger_entries")
      .select("id, account, direction, amount, created_at, ledger_transactions (id, txn_type, description, created_at)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("deposits").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("withdrawals").select("id, amount, fee, net_amount, destination_type, status, created_at").order("created_at", { ascending: false }).limit(10),
  ]);

  const total = walletTotal(balances);
  const txnList = (entries.data ?? []) as unknown as LedgerEntry[];
  const depositList = (deposits.data ?? []) as unknown as Deposit[];
  const withdrawalList = (withdrawals.data ?? []) as unknown as Withdrawal[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* balance card */}
      <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary-soft/70 via-surface to-surface">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Wallet className="size-4" /> {t("totalBalance")}
          </div>
          <p className="mt-1 font-display text-4xl font-bold">{formatINR(total)}</p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {balanceAccounts.map(({ key, labelKey, color }) => (
              <div key={key} className="rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted">{t(labelKey)}</p>
                <p className={`font-display text-base font-bold ${color}`}>{formatINR(balances[key] ?? 0)}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <DepositDialog />
            <WithdrawDialog balances={balances} />
          </div>
        </CardContent>
      </Card>

      {/* deposits needing UTR */}
      {depositList.filter((d) => d.status === "CREATED").length > 0 && (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="text-base text-warning">{t("pendingReview", { ref: "…" })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {depositList
              .filter((d) => d.status === "CREATED")
              .map((d) => (
                <div key={d.id} className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
                  <p className="font-semibold">{formatINR(d.amount)} · {d.reference_code}</p>
                  <p className="mt-1 text-muted">{t("pendingReview", { ref: d.reference_code })}</p>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4.5 text-primary" /> {t("transactions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txnList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t("noTransactions")}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {txnList.map((e) => {
                const isCredit = e.direction === "CREDIT";
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {t(`txnTypes.${e.ledger_transactions?.txn_type ?? "DEPOSIT"}`)}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {e.ledger_transactions?.description ?? ""} ·{" "}
                        {new Date(e.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className={`flex shrink-0 items-center gap-1 font-display text-sm font-bold ${isCredit ? "text-success" : "text-danger"}`}>
                      {isCredit ? <PlusCircle className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                      {isCredit ? "+" : "−"}{formatINR(e.amount)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* withdrawals history */}
      {withdrawalList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("withdrawals")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {withdrawalList.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{formatINR(w.net_amount)} · {w.destination_type}</p>
                    <p className="text-xs text-muted">{new Date(w.created_at).toLocaleString()}</p>
                  </div>
                  <span className="text-xs font-semibold text-muted">{t(`txnStatus.${w.status}`)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
