"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  LayoutDashboard, Trophy, ArrowDownToLine, ArrowUpFromLine, Users,
  LifeBuoy, Settings, ScrollText, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items: { href: string; labelKey: string; icon: LucideIcon }[] = [
  { href: "/admin", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/admin/tournaments", labelKey: "tournaments", icon: Trophy },
  { href: "/admin/deposits", labelKey: "deposits", icon: ArrowDownToLine },
  { href: "/admin/withdrawals", labelKey: "withdrawals", icon: ArrowUpFromLine },
  { href: "/admin/users", labelKey: "users", icon: Users },
  { href: "/admin/claims", labelKey: "claims", icon: LifeBuoy },
  { href: "/admin/settings", labelKey: "settings", icon: Settings },
  { href: "/admin/audit", labelKey: "auditLog", icon: ScrollText },
];

/** Admin navigation for phones (the sidebar is hidden below lg). */
export function AdminMobileNav() {
  const t = useTranslations("admin");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("title")}
      className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-pill border px-3.5 py-2 text-xs font-semibold transition-colors",
              active
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
