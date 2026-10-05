import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { getCurrentUser, isAdminUser, getProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const admin = await isAdminUser();
  if (!admin) redirect("/");
  const profile = await getProfile();

  return (
    <div className="flex min-h-dvh">
      <AdminSidebar email={user.email ?? ""} name={profile?.display_name ?? profile?.username ?? "Admin"} />
      <main className="flex-1 overflow-x-hidden px-5 py-6 md:px-8">
        <AdminMobileNav />
        {children}
      </main>
    </div>
  );
}
