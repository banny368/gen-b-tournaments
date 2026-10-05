"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Dialog } from "@radix-ui/react-dialog";
import { DialogContent as SharedDialogContent, DialogTitle as SharedDialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function CreateClanButton() {
  const t = useTranslations("clans");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    const supabase = createClient();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const { error } = await supabase.from("clans").insert({
      name,
      tag: tag.toUpperCase(),
      description: description || null,
      owner_id: user.id,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // join own clan as OWNER
    const { data: clan } = await supabase.from("clans").select("id").eq("name", name).maybeSingle();
    if (clan) {
      await supabase.from("clan_members").insert({ clan_id: clan.id, user_id: user.id, role: "OWNER" });
    }
    toast.success(tc("save"));
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> {t("create")}
      </Button>
      <SharedDialogContent className="glass max-w-sm rounded-card p-6" aria-describedby={undefined}>
        <SharedDialogTitle className="font-display text-lg font-bold">{t("create")}</SharedDialogTitle>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="clan-name">{t("name")}</Label>
            <Input id="clan-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clan-tag">{t("tag")}</Label>
            <Input id="clan-tag" value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} maxLength={5} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clan-desc">{t("description")}</Label>
            <Textarea id="clan-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <Button className="w-full" disabled={!name.trim() || !tag.trim() || loading} onClick={create}>
            {t("create")}
          </Button>
        </div>
      </SharedDialogContent>
    </Dialog>
  );
}
