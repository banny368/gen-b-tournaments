import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlagToggle, SettingRow } from "@/components/admin/flag-toggle";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();

  const [flags, settings] = await Promise.all([
    admin.from("feature_flags").select("*").order("key"),
    admin.from("admin_settings").select("*").order("category"),
  ]);

  const flagList = (flags.data ?? []) as { key: string; enabled: boolean; description: string }[];
  const settingList = (settings.data ?? []) as { key: string; category: string; value: unknown; description: string }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("settings")}</h1>

      <div className="rounded-card border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
        <ShieldAlert className="mr-2 inline size-4" />
        {t("complianceBanner")}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("flags")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {flagList.map((f) => (
            <FlagToggle key={f.key} flagKey={f.key} enabled={f.enabled} description={f.description} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingList.map((s) => (
            <SettingRow key={s.key} settingKey={s.key} category={s.category} value={JSON.stringify(s.value)} description={s.description} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
