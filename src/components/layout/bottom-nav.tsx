"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Home, Trophy, Wallet, Gift, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const items: { href: string; labelKey: string; icon: LucideIcon }[] = [
  { href: "/", labelKey: "home", icon: Home },
  { href: "/tournaments", labelKey: "tournaments", icon: Trophy },
  { href: "/wallet", labelKey: "wallet", icon: Wallet },
  { href: "/rewards", labelKey: "rewards", icon: Gift },
  { href: "/profile", labelKey: "profile", icon: User },
];

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("home")}
      className="glass fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-around border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-16 flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
            <span>{t(labelKey)}</span>
            {active && <span className="absolute -top-px h-0.5 w-8 rounded-full bg-primary" />}
          </Link>
        );
      })}
    </nav>
  );
}
