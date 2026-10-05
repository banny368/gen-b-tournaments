"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

export function RewardClaimButton({
  campaignId,
  label,
  variant = "default",
}: {
  campaignId: string;
  label: string;
  variant?: "default" | "accent";
}) {
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);

  async function claim() {
    setLoading(true);
    const user = (await createClient().auth.getUser()).data.user;
    if (!user) {
      setLoading(false);
      return;
    }
    const res = await callRpc("grant_reward", { p_user: user.id, p_campaign_id: campaignId });
    setLoading(false);
    if (res.success) {
      setClaimed(true);
      toast.success(`+₹${(res.data as { amount: number })?.amount ?? 0}`);
      router.refresh(); // sync header wallet chip + balances
    } else if (res.error?.code === "DAILY_CAP_REACHED" || res.error?.code === "COOLDOWN") {
      toast.info(res.error.message);
    } else {
      toast.error(res.error && te.has(res.error.code) ? te(res.error.code) : res.error?.message ?? tc("unknownError"));
    }
  }

  return (
    <Button variant={variant} onClick={claim} disabled={loading || claimed}>
      {claimed ? <Check /> : loading ? "…" : label}
    </Button>
  );
}
