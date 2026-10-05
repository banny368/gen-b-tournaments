import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { NewClaimButton } from "@/components/claims/new-claim-button";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "muted"> = {
  OPEN: "warning",
  IN_REVIEW: "default",
  WAITING_USER: "warning",
  WAITING_ADMIN: "default",
  RESOLVED: "success",
  REJECTED: "danger",
  CLOSED: "muted",
};

export default async function ClaimsPage() {
  const t = await getTranslations("claims");
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("claims")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  const list = (data ?? []) as {
    id: string;
    ticket_code: string;
    category: string;
    subject: string;
    status: string;
    created_at: string;
  }[];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LifeBuoy className="size-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
        </div>
        <NewClaimButton />
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<LifeBuoy className="size-10" />} title={t("noClaims")} />
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{c.subject}</p>
                  <Badge variant={statusVariant[c.status] ?? "muted"}>{t(`status.${c.status}`)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {c.ticket_code} · {t(`categories.${c.category}`)} ·{" "}
                  {new Date(c.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
