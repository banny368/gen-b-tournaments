import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser, getProfile, isAdminUser } from "@/lib/auth";
import {
  isSupabaseConfigured,
  getWalletBalances,
  walletTotal,
} from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("tagline"),
    applicationName: t("name"),
    manifest: "/manifest.webmanifest",
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages();

  // graceful degraded mode before Supabase env vars exist (setup screen, no crash)
  if (!isSupabaseConfigured()) {
    return (
      <html lang={locale} className={`${inter.variable} ${spaceGrotesk.variable}`}>
        <body>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <Providers>
              <SetupNotice />
            </Providers>
          </NextIntlClientProvider>
        </body>
      </html>
    );
  }

  const user = await getCurrentUser();
  let shellUser = null;
  let walletBalance: number | null = null;
  let unread = 0;

  if (user) {
    const [profile, admin, supabase] = await Promise.all([
      getProfile(),
      isAdminUser(),
      createClient(),
    ]);
    if (profile && !profile.is_banned) {
      const [balances, notifs] = await Promise.all([
        getWalletBalances(user.id),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null),
      ]);
      shellUser = {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        is_admin: admin,
      };
      walletBalance = walletTotal(balances);
      unread = notifs.count ?? 0;
    }
  }

  return (
    <html lang={locale} className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>
            <ServiceWorkerRegistration />
            <AppShell user={shellUser} walletBalance={walletBalance} unreadNotifications={unread}>
              {children}
            </AppShell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function SetupNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="glass max-w-md rounded-card p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent font-display text-lg font-bold text-white">
          GB
        </div>
        <h1 className="font-display text-xl font-bold">Gen B Tournaments</h1>
        <p className="mt-2 text-sm text-muted">
          Backend not configured yet. Add <code className="rounded bg-surface-2 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-surface-2 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
          <code className="rounded bg-surface-2 px-1">.env.local</code>, then run{" "}
          <code className="rounded bg-surface-2 px-1">npm run db:migrate</code>.
        </p>
      </div>
    </div>
  );
}
