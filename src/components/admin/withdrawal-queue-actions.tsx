"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reviewWithdrawalAction } from "@/lib/admin-actions";

export function WithdrawalQueueActions({ withdrawalId, status }: { withdrawalId: string; status: string }) {
  const t = useTranslations("admin");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function run(action: "APPROVE" | "COMPLETE" | "REJECT") {
    setLoading(true);
    const res = await reviewWithdrawalAction(withdrawalId, action, reference, reason);
    setLoading(false);
    if (res.success) toast.success("Done");
    else toast.error(res.error);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {status === "REQUESTED" && (
        <Button size="sm" disabled={loading} onClick={() => run("APPROVE")}>
          {t("approve")}
        </Button>
      )}
      {(status === "APPROVED" || status === "PROCESSING") && (
        <>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Payout reference / UTR"
            className="h-9 w-48 text-xs"
          />
          <Button size="sm" disabled={loading} onClick={() => run("COMPLETE")}>
            Mark paid
          </Button>
        </>
      )}
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("reason")}
        className="h-9 w-40 text-xs"
      />
      <Button
        size="sm"
        variant="danger"
        disabled={loading}
        onClick={() => {
          if (!reason) {
            toast.error(t("reasonRequired"));
            return;
          }
          run("REJECT");
        }}
      >
        {t("reject")}
      </Button>
    </div>
  );
}
