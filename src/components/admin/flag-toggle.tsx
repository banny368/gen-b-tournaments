"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@radix-ui/react-switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toggleFlagAction, updateSettingAction } from "@/lib/admin-actions";

export function FlagToggle({ flagKey, enabled, description }: { flagKey: string; enabled: boolean; description: string }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
      <div>
        <p className="font-mono text-sm font-semibold">{flagKey}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <Switch
        checked={on}
        disabled={pending}
        onCheckedChange={(v) => {
          setOn(v);
          start(async () => {
            const res = await toggleFlagAction(flagKey, v);
            if (!res.success) {
              setOn(!v);
              toast.error(res.error);
            }
          });
        }}
        className="relative h-6 w-11 rounded-full bg-surface-2 transition-colors data-[state=checked]:bg-primary"
      >
        <span className="block size-4.5 translate-x-1 rounded-full bg-white transition-transform data-[state=checked]:translate-x-5.5" />
      </Switch>
    </div>
  );
}

export function SettingRow({
  settingKey,
  category,
  value,
  description,
}: {
  settingKey: string;
  category: string;
  value: string;
  description: string;
}) {
  const [draft, setDraft] = useState(value);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold">
            {settingKey} <span className="text-xs font-normal text-muted">({category})</span>
          </p>
          <p className="truncate text-xs text-muted">{description}</p>
        </div>
        <div className="flex w-72 shrink-0 gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-9 font-mono text-xs" />
          <Button
            size="sm"
            disabled={pending || draft === value}
            onClick={() =>
              start(async () => {
                const res = await updateSettingAction(settingKey, draft);
                if (res.success) toast.success("Saved");
                else toast.error(res.error);
              })
            }
          >
            {pending ? "…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
