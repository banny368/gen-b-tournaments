"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Dialog } from "@radix-ui/react-dialog";
import { DialogContent as SharedDialogContent, DialogTitle as SharedDialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { banUserAction, grantRoleAction, manualAdjustmentAction } from "@/lib/admin-actions";

const ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN", "TOURNAMENT_ADMIN", "SUPPORT_ADMIN", "MODERATOR", "CONTENT_ADMIN", "RISK_ADMIN", "ANALYST"];
const ACCOUNTS = ["DEPOSIT", "BONUS", "REWARD", "WINNINGS", "REFUND"];

export function UserRowActions({
  userId,
  username,
  isBanned,
  roles,
}: {
  userId: string;
  username: string;
  isBanned: boolean;
  roles: string[];
}) {
  const t = useTranslations("admin");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setLoading(true);
    const res = await fn();
    setLoading(false);
    if (res.success) toast.success("Done");
    else toast.error(res.error);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
          {t("adjustBalance")}
        </Button>
        <SharedDialogContent className="glass max-w-sm rounded-card p-6" aria-describedby={undefined}>
          <SharedDialogTitle className="font-display text-base font-bold">{t("adjustBalance")} · @{username}</SharedDialogTitle>
          <p className="mt-1 text-xs text-warning">{t("adjustWarning")}</p>
          <form
            action={async (fd) => {
              await run(() =>
                manualAdjustmentAction(
                  userId,
                  String(fd.get("account")),
                  parseFloat(String(fd.get("amount"))),
                  String(fd.get("reason")),
                ),
              );
              setAdjustOpen(false);
            }}
            className="mt-4 space-y-3"
          >
            <Select name="account" defaultValue="BONUS">
              {ACCOUNTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
            <Input name="amount" type="number" step="0.01" placeholder="±100 (negative = debit)" required />
            <Input name="reason" placeholder="Reason (required)" required />
            <Button type="submit" className="w-full" disabled={loading}>
              Apply
            </Button>
          </form>
        </SharedDialogContent>
      </Dialog>

      <Select
        defaultValue=""
        className="h-9 w-44 text-xs"
        onChange={(e) => {
          if (!e.target.value) return;
          const [role, grant] = e.target.value.split(":");
          run(() => grantRoleAction(userId, role, grant === "1"));
          e.target.value = "";
        }}
      >
        <option value="">Roles…</option>
        {ROLES.map((r) =>
          roles.includes(r) ? (
            <option key={r} value={`${r}:0`}>
              Revoke {r}
            </option>
          ) : (
            <option key={r} value={`${r}:1`}>
              Grant {r}
            </option>
          ),
        )}
      </Select>

      <Button
        variant={isBanned ? "secondary" : "danger"}
        size="sm"
        disabled={loading}
        onClick={() => {
          if (isBanned) {
            run(() => banUserAction(userId, false, ""));
            return;
          }
          const reason = prompt("Ban reason:") ?? "";
          if (reason) run(() => banUserAction(userId, true, reason));
        }}
      >
        {isBanned ? "Unban" : "Ban"}
      </Button>
    </div>
  );
}
