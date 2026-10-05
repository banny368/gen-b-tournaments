"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, PlusCircle, RefreshCw } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog } from "@radix-ui/react-dialog";
import { DialogContent as SharedDialogContent, DialogTitle as SharedDialogTitle } from "@/components/ui/dialog";
import { callRpc } from "@/lib/rpc";
import { formatINR } from "@/lib/utils";

type Step = "choose" | "amount" | "upi_pay" | "utr";

interface DepositData {
  deposit_id: string;
  upi_id: string | null;
  upi_name: string | null;
  instructions: string | null;
}

export function DepositDialog() {
  const t = useTranslations("wallet");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [amount, setAmount] = useState("");
  const [deposit, setDeposit] = useState<DepositData | null>(null);
  const [utr, setUtr] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep("choose");
    setAmount("");
    setDeposit(null);
    setUtr("");
  }

  /** Demo mode: bonus credits through the standard reward ledger path (sandbox only). */
  async function demoCredits() {
    setLoading(true);
    const res = await callRpc("claim_demo_credits", {});
    setLoading(false);
    if (res.success) {
      const data = res.data as { amount?: number } | undefined;
      toast.success(`+${data?.amount ?? 0} ${t("bonus")}`);
      setOpen(false);
      reset();
      router.refresh();
    } else {
      toast.error(res.error && te.has(res.error.code) ? te(res.error.code) : res.error?.message ?? tc("unknownError"));
    }
  }

  async function startManualUpi() {
    setLoading(true);
    const res = await callRpc("create_deposit_request", {
      p_amount: parseFloat(amount),
      p_provider: "MANUAL_UPI",
    });
    setLoading(false);
    if (res.success) {
      setDeposit(res.data as DepositData);
      setStep("upi_pay");
    } else {
      toast.error(res.error && te.has(res.error.code) ? te(res.error.code) : tc("unknownError"));
    }
  }

  async function submitUtr() {
    if (!deposit) return;
    setLoading(true);
    const res = await callRpc("submit_deposit_utr", { p_deposit_id: deposit.deposit_id, p_utr: utr.trim() });
    setLoading(false);
    if (res.success) {
      toast.success(t("pendingReview", { ref: "—" }));
      setOpen(false);
      router.refresh();
      reset();
    } else {
      toast.error(res.error && te.has(res.error.code) ? te(res.error.code) : res.error?.message ?? tc("unknownError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <Button onClick={() => setOpen(true)}>
        <PlusCircle /> {t("addMoney")}
      </Button>
      <SharedDialogContent className="glass max-w-md rounded-card p-6" aria-describedby={undefined}>
        <SharedDialogTitle className="font-display text-lg font-bold">{t("addMoney")}</SharedDialogTitle>

        {step === "choose" && (
          <div className="mt-4 space-y-3">
            <Button variant="secondary" className="w-full justify-start" onClick={() => setStep("amount")}>
              {t("manualUpiTitle")}
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={demoCredits} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : ""} /> {t("demoCredits")}
            </Button>
            <p className="text-xs text-muted">{t("payExactAmount")}</p>
          </div>
        )}

        {step === "amount" && (
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dep-amount">{t("amount")}</Label>
              <Input
                id="dep-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="flex gap-2">
              {[100, 200, 500, 1000].map((v) => (
                <Button key={v} variant="outline" size="sm" onClick={() => setAmount(String(v))}>
                  ₹{v}
                </Button>
              ))}
            </div>
            <Button className="w-full" disabled={!amount || parseFloat(amount) <= 0 || loading} onClick={startManualUpi}>
              {t("submit")}
            </Button>
          </div>
        )}

        {step === "upi_pay" && deposit && (
          <div className="mt-4 space-y-4 text-sm">
            <p className="font-medium text-warning">{t("manualUpiStep1")}</p>
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/50 px-4 py-3">
              <div>
                <p className="text-xs text-muted">{t("upiId")}</p>
                <p className="select-all font-display text-base font-bold">{deposit.upi_id || "—"}</p>
                {deposit.upi_name && <p className="text-xs text-muted">{deposit.upi_name}</p>}
              </div>
              {deposit.upi_id && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("utr")}
                  onClick={() => {
                    navigator.clipboard.writeText(deposit.upi_id!);
                    toast.success(tc("copied"));
                  }}
                >
                  <Copy />
                </Button>
              )}
            </div>
            <div className="rounded-xl border border-border bg-surface-2/40 p-3">
              <p className="text-muted">{t("manualUpiStep2")}</p>
              <p className="mt-1 text-muted">{t("manualUpiStep3")}</p>
              <p className="mt-2 font-semibold">{formatINR(parseFloat(amount))}</p>
            </div>
            <Button className="w-full" onClick={() => setStep("utr")}>
              {t("submitUtr")}
            </Button>
          </div>
        )}

        {step === "utr" && (
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="utr">{t("utr")}</Label>
              <Input id="utr" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="123456789012" />
              <p className="text-xs text-muted">{t("utrHint")}</p>
            </div>
            <Button className="w-full" disabled={utr.trim().length < 6 || loading} onClick={submitUtr}>
              {t("submitUtr")}
            </Button>
          </div>
        )}
      </SharedDialogContent>
    </Dialog>
  );
}
