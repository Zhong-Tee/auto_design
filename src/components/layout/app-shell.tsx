import { Toaster } from "@/components/ui/sonner";
import { MainNav } from "@/components/layout/main-nav";
import { GenerateQueueProvider } from "@/components/generate-queue-provider";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <GenerateQueueProvider>
      <div className="app-gradient-bg flex min-h-full flex-1 flex-col">
        {profile && <MainNav profile={profile} />}
        <main className="flex-1">{children}</main>
        <Toaster richColors position="top-center" />
      </div>
    </GenerateQueueProvider>
  );
}
