"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { callRpc } from "@/lib/rpc";
import { formatINR, idempotencyKey } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

export function JoinButton({
  tournamentId,
  entryFee,
  alreadyJoined,
  canJoin,
}: {
  tournamentId: string;
  entryFee: number;
  alreadyJoined: boolean;
  canJoin: boolean;
}) {
  const t = useTranslations("tournament");
  const te = useTranslations("errors");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(alreadyJoined);
  const [needsFunds, setNeedsFunds] = useState(false);

  async function join() {
    setJoining(true);
    const result = await callRpc("join_tournament", {
      p_tournament_id: tournamentId,
      p_idempotency_key: idempotencyKey("join"),
    });
    setJoining(false);
    setConfirming(false);

    if (result.success) {
      setJoined(true);
      toast.success(t("joinedSuccess"));
      router.refresh(); // sync participants list, slots, header balance
    } else if (result.error?.code === "INSUFFICIENT_BALANCE" || result.error?.code === "INSUFFICIENT_REAL_BALANCE") {
      setNeedsFunds(true);
      toast.error(te(result.error.code));
    } else if (result.error && te.has(result.error.code)) {
      toast.error(te(result.error.code));
    } else {
      toast.error(t("errorClosed"));
    }
  }

  if (joined) {
    return (
      <Button variant="secondary" disabled className="w-full">
        <CheckCircle2 className="text-success" /> {t("joined")}
      </Button>
    );
  }

  if (needsFunds) {
    return (
      <Button asChild variant="accent" className="w-full">
        <Link href="/wallet">{t("addFunds")}</Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        disabled={!canJoin || joining}
        onClick={() => setConfirming(true)}
      >
        {joining ? t("joining") : entryFee > 0 ? `${t("join")} · ${formatINR(entryFee)}` : t("join")}
      </Button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("joinConfirmTitle")}
        description={t("joinConfirmBody", { fee: formatINR(entryFee) })}
        confirmLabel={t("join")}
        destructive={entryFee > 0}
        onConfirm={join}
      />
    </>
  );
}
