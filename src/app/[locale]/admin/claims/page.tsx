import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminClaimActions } from "@/components/admin/claim-actions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminClaimsPage() {
  const t = await getTranslations("admin");
  const tc = await getTranslations("claims");
  const admin = createAdminClient();

  const { data } = await admin
    .from("claims")
    .select("*, profiles (username, display_name)")
    .not("status", "in", "(CLOSED)")
    .order("created_at", { ascending: true })
    .limit(50);

  const list = (data ?? []) as unknown as {
    id: string;
    ticket_code: string;
    category: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    created_at: string;
    profiles: { username: string | null; display_name: string | null } | null;
  }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("claims")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{list.length} open</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.map((c) => (
            <div key={c.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.subject}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {c.ticket_code} · {tc(`categories.${c.category}`)} ·{" "}
                    {c.profiles?.display_name ?? c.profiles?.username} ·{" "}
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={c.priority === "URGENT" ? "danger" : "muted"}>{c.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{c.description}</p>
              <AdminClaimActions claimId={c.id} />
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-muted">—</p>}
        </CardContent>
      </Card>
    </div>
  );
}
