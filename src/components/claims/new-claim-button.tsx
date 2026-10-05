"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { callRpc } from "@/lib/rpc";

const categories = [
  "PAYMENT", "MISSING_DEPOSIT", "WRONG_RESULT", "PRIZE", "CANCELLATION",
  "REFUND", "TECHNICAL", "CHEATING_REPORT", "ACCOUNT",
];

export function NewClaimButton() {
  const t = useTranslations("claims");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("PAYMENT");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const res = await callRpc("create_claim", {
      p_category: category,
      p_subject: subject,
      p_description: description,
    });
    setLoading(false);
    if (res.success) {
      toast.success(t("claimSubmitted"));
      setOpen(false);
      setSubject("");
      setDescription("");
      router.refresh();
    } else {
      toast.error(res.error?.message ?? tc("unknownError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> {t("newClaim")}
      </Button>
      <DialogContent className="glass max-w-md rounded-card p-6" aria-describedby={undefined}>
        <DialogTitle className="font-display text-lg font-bold">{t("newClaim")}</DialogTitle>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="claim-cat">{t("category")}</Label>
            <Select id="claim-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-subject">{t("subject")}</Label>
            <Input id="claim-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-desc">{t("description")}</Label>
            <Textarea id="claim-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <Button
            className="w-full"
            disabled={!subject.trim() || !description.trim() || loading}
            onClick={submit}
          >
            {t("submitClaim")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
