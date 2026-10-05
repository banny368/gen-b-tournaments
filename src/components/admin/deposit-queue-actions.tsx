"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approveDepositAction, rejectDepositAction } from "@/lib/admin-actions";

export function DepositQueueActions({ depositId }: { depositId: string }) {
  const t = useTranslations("admin");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setLoading(true);
    const res = await fn();
    setLoading(false);
    if (res.success) toast.success("Done");
    else toast.error(res.error);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("reason")}
        className="h-9 w-48 text-xs"
      />
      <Button size="sm" variant="default" disabled={loading} onClick={() => run(() => approveDepositAction(depositId, reason))}>
        {t("approve")}
      </Button>
      <Button
        size="sm"
        variant="danger"
        disabled={loading}
        onClick={() => {
          if (!reason) {
            toast.error(t("reasonRequired"));
            return;
          }
          run(() => rejectDepositAction(depositId, reason));
        }}
      >
        {t("reject")}
      </Button>
    </div>
  );
}
