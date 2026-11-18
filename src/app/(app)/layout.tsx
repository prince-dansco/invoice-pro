import { redirect } from "next/navigation";

import { Sidebar } from "@/components/app-shell/sidebar";
import { TopBar } from "@/components/app-shell/top-bar";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await getProfile();
  // New users set up their business first. Skipping also sets onboarded_at.
  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar accountLabel={profile.business_name || user.email || "Account"} />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
