"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Bell, Search, Wallet } from "lucide-react";
import { formatINR } from "@/lib/utils";

interface TopBarProps {
  walletBalance: number | null;
  unreadNotifications: number;
}

export function TopBar({ walletBalance, unreadNotifications }: TopBarProps) {
  const t = useTranslations("nav");
  const th = useTranslations("home");

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-lg md:px-8">
      <Link href="/" className="flex items-center gap-2 md:hidden">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent font-display text-xs font-bold text-white">
          GB
        </div>
      </Link>

      {/* desktop search */}
      <Link
        href="/tournaments"
        className="hidden h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-4 text-sm text-muted transition-colors hover:border-primary/40 md:flex"
      >
        <Search className="size-4" />
        {t("tournaments")}
      </Link>

      <div className="flex-1 md:hidden" />

      {walletBalance !== null && (
        <Link
          href="/wallet"
          className="flex items-center gap-1.5 rounded-pill border border-primary/30 bg-primary-soft/50 px-3 py-1.5 text-sm font-semibold text-[#9db8ff]"
          aria-label={th("walletBalance")}
        >
          <Wallet className="size-4" />
          {formatINR(walletBalance)}
        </Link>
      )}

      <Link
        href="/notifications"
        className="relative flex size-10 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:text-foreground"
        aria-label={t("notifications")}
      >
        <Bell className="size-5" />
        {unreadNotifications > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-live px-1 text-[10px] font-bold text-white">
            {unreadNotifications > 99 ? "99+" : unreadNotifications}
          </span>
        )}
      </Link>
    </header>
  );
}
