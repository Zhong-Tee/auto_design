import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl">
      <AdminSidebar />
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
