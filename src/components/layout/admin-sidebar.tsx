"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { href: "/admin", label: "แดชบอร์ด" },
  { href: "/admin/users", label: "ผู้ใช้" },
  { href: "/admin/products", label: "สินค้า" },
  { href: "/admin/patterns", label: "รูปแบบ" },
  { href: "/admin/prompts", label: "คลัง Prompt" },
  { href: "/admin/settings", label: "ตั้งค่า" },
  { href: "/admin/reports", label: "รายงาน" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-primary/10 bg-card/60 p-5 backdrop-blur-sm">
      <div className="mb-6">
        <Link
          href="/"
          className="text-base text-muted-foreground transition-colors hover:text-primary"
        >
          ← กลับหน้าหลัก
        </Link>
        <h2 className="mt-3 text-xl font-bold brand-gradient-text">จัดการระบบ</h2>
      </div>
      <nav className="flex flex-col gap-1">
        {adminNavItems.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-2.5 text-base transition-all hover:translate-x-1",
                active
                  ? "nav-link-active"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
