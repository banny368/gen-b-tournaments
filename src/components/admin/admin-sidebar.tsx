"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  LayoutDashboard, Trophy, ArrowDownToLine, ArrowUpFromLine, Users,
  LifeBuoy, Settings, ScrollText, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function AdminSidebar({ name, email }: { name: string; email: string }) {
  const t = useTranslations("admin");
  const tn = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();

  const items = [
    { href: "/admin", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/admin/tournaments", label: t("tournaments"), icon: Trophy },
    { href: "/admin/deposits", label: t("deposits"), icon: ArrowDownToLine },
    { href: "/admin/withdrawals", label: t("withdrawals"), icon: ArrowUpFromLine },
    { href: "/admin/users", label: t("users"), icon: Users },
    { href: "/admin/claims", label: t("claims"), icon: LifeBuoy },
    { href: "/admin/settings", label: t("settings"), icon: Settings },
    { href: "/admin/audit", label: t("auditLog"), icon: ScrollText },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-danger to-warning font-display text-sm font-bold text-white">
          GB
        </div>
        <div>
          <p className="font-display text-sm font-bold">{t("title")}</p>
          <p className="truncate text-[10px] text-muted">{email}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary-soft/70 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={async () => {
            await createClient().auth.signOut();
            router.push("/");
            router.refresh();
          }}
          className="mb-1 w-full rounded-xl px-3 py-2 text-left text-xs text-muted hover:bg-surface-2"
        >
          {tn("signOut")} · {name}
        </button>
        <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted hover:bg-surface-2">
          <ArrowLeft className="size-3.5" /> {tn("home")}
        </Link>
      </div>
    </aside>
  );
}
