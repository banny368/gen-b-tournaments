"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Home, Trophy, Wallet, Gift, User, Users, MessagesSquare, BarChart3,
  Swords, LifeBuoy, Bell, Shield, LogOut, type LucideIcon,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SidebarUser {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
}

export function Sidebar({ user }: { user: SidebarUser | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  

  const main: { href: string; labelKey: string; icon: LucideIcon }[] = [
    { href: "/", labelKey: "home", icon: Home },
    { href: "/tournaments", labelKey: "tournaments", icon: Trophy },
    { href: "/wallet", labelKey: "wallet", icon: Wallet },
    { href: "/rewards", labelKey: "rewards", icon: Gift },
  ];
  const social: { href: string; labelKey: string; icon: LucideIcon }[] = [
    { href: "/leaderboard", labelKey: "leaderboard", icon: BarChart3 },
    { href: "/chat", labelKey: "chat", icon: MessagesSquare },
    { href: "/clans", labelKey: "clans", icon: Users },
  ];
  const personal: { href: string; labelKey: string; icon: LucideIcon }[] = [
    { href: "/my-matches", labelKey: "myMatches", icon: Swords },
    { href: "/notifications", labelKey: "notifications", icon: Bell },
    { href: "/profile", labelKey: "profile", icon: User },
    { href: "/claims", labelKey: "claims", icon: LifeBuoy },
  ];

  async function signOut() {
    await createClient().auth.signOut();
    toast.success(t("signOut"));
    router.push("/");
    router.refresh();
  }

  const section = (items: typeof main, label?: string) => (
    <div className="space-y-1">
      {label && <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted/70">{label}</p>}
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-primary-soft/70 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4.5", active && "text-primary")} strokeWidth={active ? 2.2 : 1.8} />
            {t(labelKey)}
          </Link>
        );
      })}
    </div>
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface/70 px-4 py-5 md:flex">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent font-display text-base font-bold text-white shadow-glow">
          GB
        </div>
        <div>
          <p className="font-display text-sm font-bold leading-tight">GEN B</p>
          <p className="text-[10px] uppercase tracking-widest text-muted">Tournaments</p>
        </div>
      </Link>

      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {section(main)}
        {section(social)}
        {section(personal)}
        {user?.is_admin && section([{ href: "/admin", labelKey: "admin", icon: Shield }])}
      </div>

      {user ? (
        <div className="mt-4 border-t border-border pt-4">
          <Link href="/profile" className="mb-1 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-surface-2 font-display text-xs font-bold text-primary">
              {(user.display_name ?? user.username ?? "P").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.display_name ?? user.username}</p>
              <p className="truncate text-xs text-muted">@{user.username}</p>
            </div>
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-danger"
          >
            <LogOut className="size-4" /> {t("signOut")}
          </button>
        </div>
      ) : (
        <div className="mt-4 border-t border-border pt-4">
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-glow transition-colors hover:bg-primary-strong"
          >
            {t("signIn")}
          </Link>
        </div>
      )}
    </aside>
  );
}
