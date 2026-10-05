import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();

  const { data } = await admin
    .from("profiles")
    .select("id, username, display_name, player_code, is_banned, is_verified, created_at, user_roles (role)")
    .order("created_at", { ascending: false })
    .limit(100);

  const users = (data ?? []) as unknown as {
    id: string;
    username: string | null;
    display_name: string | null;
    player_code: string;
    is_banned: boolean;
    created_at: string;
    user_roles: { role: string }[];
  }[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("users")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{users.length} users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  {u.display_name ?? u.username}
                  {u.is_banned && <Badge variant="danger">BANNED</Badge>}
                  {u.user_roles?.length > 0 && <Badge variant="accent">{u.user_roles.map((r) => r.role).join(", ")}</Badge>}
                </p>
                <p className="text-xs text-muted">
                  @{u.username} · {u.player_code} · {new Date(u.created_at).toLocaleDateString()}
                </p>
              </div>
              <UserRowActions userId={u.id} username={u.username ?? ""} isBanned={u.is_banned} roles={u.user_roles?.map((r) => r.role) ?? []} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
