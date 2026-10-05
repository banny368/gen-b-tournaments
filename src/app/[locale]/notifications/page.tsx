import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  const list = (data ?? []) as {
    id: string;
    title: string;
    body: string | null;
    read_at: string | null;
    created_at: string;
  }[];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="size-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
        </div>
        {list.some((n) => !n.read_at) && <MarkAllReadButton />}
      </div>

      {list.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="space-y-2">
          {list.map((n) => (
            <Card key={n.id} className={n.read_at ? "opacity-60" : "border-primary/30"}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
