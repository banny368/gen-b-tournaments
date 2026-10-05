import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();

  const { data } = await admin
    .from("audit_logs")
    .select("*, profiles (username, display_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const logs = (data ?? []) as unknown as {
    id: string;
    actor_id: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    reason: string | null;
    created_at: string;
    profiles: { username: string | null; display_name: string | null } | null;
  }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("auditLog")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last {logs.length} events (append-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
              <div>
                <p className="font-mono text-xs font-semibold">
                  {l.action} <span className="text-muted">→ {l.resource_type}:{(l.resource_id ?? "—").slice(0, 8)}</span>
                </p>
                <p className="text-xs text-muted">
                  {l.profiles?.display_name ?? l.profiles?.username ?? "system"}
                  {l.reason ? ` · ${l.reason}` : ""}
                </p>
              </div>
              <span className="text-xs text-muted">{new Date(l.created_at).toLocaleString()}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="py-4 text-center">
              <Badge variant="muted">No audit events yet</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
