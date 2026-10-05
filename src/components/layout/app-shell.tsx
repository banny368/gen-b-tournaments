import { AppShellClient } from "./app-shell-client";

export interface ShellUser {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
}

export function AppShell({
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
    <AppShellClient user={user} walletBalance={walletBalance} unreadNotifications={unreadNotifications}>
      {children}
    </AppShellClient>
  );
}
