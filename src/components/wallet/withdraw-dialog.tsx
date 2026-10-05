"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog } from "@radix-ui/react-dialog";
import { DialogContent as SharedDialogContent, DialogTitle as SharedDialogTitle } from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { callRpc } from "@/lib/rpc";
import { formatINR } from "@/lib/utils";
import type { WalletBalances } from "@/lib/types";

export function WithdrawDialog({ balances }: { balances: WalletBalances }) {
  const t = useTranslations("wallet");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("UPI");
  const [upiId, setUpiId] = useState("");
  const [fee, setFee] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const withdrawable = balances.WINNINGS ?? 0;

  async function previewFee(value: string) {
    setAmount(value);
    const n = parseFloat(value);
    if (!Number.isFinite(n) || n <= 0) {
      setFee(null);
      return;
    }
    const res = await callRpc<number>("compute_withdrawal_fee", { p_amount: n });
    if (res.success && typeof res.data === "number") setFee(res.data);
  }

  async function submit() {
    setLoading(true);
    const res = await callRpc("request_withdrawal", {
      p_amount: parseFloat(amount),
      p_destination_type: destination,
      p_destination_details: { upi_id: upiId.trim() },
    });
    setLoading(false);
    if (res.success) {
      toast.success(t("withdrawSuccess"));
      router.refresh();
      setOpen(false);
      setAmount("");
      setUpiId("");
      setFee(null);
    } else {
      toast.error(res.error && te.has(res.error.code) ? te(res.error.code) : res.error?.message ?? tc("unknownError"));
    }
  }

  const net = fee !== null && amount ? Math.max(0, parseFloat(amount) - fee) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <ArrowUpRight /> {t("withdraw")}
      </Button>
      <SharedDialogContent className="glass max-w-md rounded-card p-6" aria-describedby={undefined}>
        <SharedDialogTitle className="font-display text-lg font-bold">{t("withdrawTitle")}</SharedDialogTitle>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-surface-2/40 px-4 py-3 text-sm">
            <p className="text-xs text-muted">{t("winnings")}</p>
            <p className="font-display text-lg font-bold text-success">{formatINR(withdrawable)}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wd-amount">{t("amount")}</Label>
            <Input
              id="wd-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => previewFee(e.target.value)}
              placeholder="500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wd-dest">{t("withdrawDestination")}</Label>
            <Select id="wd-dest" value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="UPI">{t("upi")}</option>
              <option value="BANK" disabled>
                {t("bank")} (soon)
              </option>
            </Select>
          </div>

          {destination === "UPI" && (
            <div className="space-y-1.5">
              <Label htmlFor="wd-upi">{t("upiId")}</Label>
              <Input id="wd-upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@upi" />
            </div>
          )}

          {net !== null && (
            <div className="rounded-xl border border-border bg-surface-2/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">{t("withdrawFee")}</span>
                <span>{formatINR(fee ?? 0)}</span>
              </div>
              <div className="mt-1 flex justify-between font-semibold">
                <span>{t("withdrawNet")}</span>
                <span className="text-success">{formatINR(net)}</span>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            disabled={!amount || parseFloat(amount) <= 0 || !upiId.trim() || loading}
            onClick={submit}
          >
            {t("submit")}
          </Button>
        </div>
      </SharedDialogContent>
    </Dialog>
  );
}
