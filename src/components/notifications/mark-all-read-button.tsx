"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function MarkAllReadButton() {
  const t = useTranslations("notifications");
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        const supabase = createClient();
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
          await supabase
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .is("read_at", null);
        }
        router.refresh();
      }}
    >
      <CheckCheck /> {t("markAllRead")}
    </Button>
  );
}
