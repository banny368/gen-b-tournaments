import { getTranslations } from "next-intl/server";
import { Swords } from "lucide-react";
import { SignInForm } from "@/components/auth/sign-in-form";

export default async function LoginPage() {
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
          <Swords className="size-7 text-white" />
        </div>
        <h1 className="font-display text-2xl font-bold">{t("signInTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("signInSubtitle")}</p>
      </div>
      <div className="glass rounded-card p-6 shadow-card">
        <SignInForm />
      </div>
    </div>
  );
}
