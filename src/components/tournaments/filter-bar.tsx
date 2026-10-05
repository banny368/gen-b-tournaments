"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import type { Game } from "@/lib/types";

export function FilterBar({
  games,
  current,
}: {
  games: Game[];
  current: { game?: string; status?: string; q?: string };
}) {
  const t = useTranslations("tournament");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder={t("title")}
          defaultValue={current.q}
          className="pl-10"
          onKeyDown={(e) => {
            if (e.key === "Enter") update("q", (e.target as HTMLInputElement).value || undefined);
          }}
          onBlur={(e) => {
            if (e.target.value !== (current.q ?? "")) update("q", e.target.value || undefined);
          }}
        />
      </div>
      <div className="flex gap-3">
        <Select value={current.game ?? ""} onChange={(e) => update("game", e.target.value || undefined)}>
          <option value="">{t("filterGame")}</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.short_name}
            </option>
          ))}
        </Select>
        <Select value={current.status ?? ""} onChange={(e) => update("status", e.target.value || undefined)}>
          <option value="">{t("filterStatus")}</option>
          <option value="SCHEDULED,REGISTRATION_OPEN">{t("status.REGISTRATION_OPEN")}</option>
          <option value="LIVE">{t("status.LIVE")}</option>
          <option value="COMPLETED">{t("status.COMPLETED")}</option>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          aria-label="reset"
          onClick={() => router.push(pathname)}
        >
          ×
        </Button>
      </div>
    </div>
  );
}
