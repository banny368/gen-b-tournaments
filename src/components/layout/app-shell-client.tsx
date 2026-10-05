"use client";

import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";

interface ShellUser {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
}

export function AppShellClient({
  user,
  walletBalance,
  unreadNotifications,
  children,
}: {
  user: ShellUser | null;
  walletBalance: number | null;
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <Sidebar user={user} />
      <div className="md:pl-64">
        <TopBar walletBalance={walletBalance} unreadNotifications={unreadNotifications} />
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 md:px-8 md:pb-10">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
