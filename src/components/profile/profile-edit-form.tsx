"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function ProfileEditForm({
  profile,
  privateData,
}: {
  profile: { display_name: string | null; bio: string | null; language: string; referral_code: string };
  privateData: { date_of_birth: string | null; phone: string | null; state_code: string | null };
}) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [language, setLanguage] = useState(profile.language);
  const [dob, setDob] = useState(privateData.date_of_birth ?? "");
  const [phone, setPhone] = useState(privateData.phone ?? "");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    const supabase = createClient();
    const userId = (await supabase.auth.getUser()).data.user!.id;
    const [profileRes, privateRes] = await Promise.all([
      supabase
        .from("profiles")
        .update({ display_name: displayName || null, bio: bio || null, language })
        .eq("id", userId),
      supabase.from("profile_private").upsert({
        user_id: userId,
        date_of_birth: dob || null,
        phone: phone || null,
      }),
    ]);
    setLoading(false);
    if (profileRes.error || privateRes.error) {
      toast.error(profileRes.error?.message ?? privateRes.error?.message ?? tc("unknownError"));
      return;
    }
    toast.success(tc("save"));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("editProfile")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">{t("displayName")}</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dob">
              {t("dateOfBirth")} <span className="text-muted">({t("private")})</span>
            </Label>
            <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            <p className="text-xs text-muted">{t("dateOfBirthHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">
              {t("phone")} <span className="text-muted">({t("private")})</span>
            </Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lang">{t("language")}</Label>
            <select
              id="lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-border bg-surface-2/60 px-4 text-sm"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="gu">ગુજરાતી</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">{t("bio")}</Label>
          <Input id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>

        {/* referral code */}
        <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
          <div>
            <p className="text-xs text-muted">{t("playerId")}</p>
            <p className="select-all font-display text-base font-bold tracking-widest text-accent">
              {profile.referral_code}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label={tc("copy")}
            onClick={() => {
              navigator.clipboard.writeText(profile.referral_code);
              toast.success(tc("copied"));
            }}
          >
            <Copy />
          </Button>
        </div>

        <Button onClick={save} disabled={loading}>
          {loading ? "…" : tc("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
