"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageSquare, Users, Radio, Settings } from "lucide-react";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { cn } from "@/lib/utils";

function BottomNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalUnread = useTotalUnread();

  // If viewing an active conversation on mobile in /inbox, hide the bottom bar
  // so the chat thread and keyboard have full height.
  const hasActiveChat = pathname === "/inbox" && !!searchParams.get("c");
  if (hasActiveChat) return null;

  const tabs = [
    {
      label: "Chats",
      href: "/inbox",
      icon: MessageSquare,
      badge: totalUnread > 0 ? totalUnread : null,
      isActive: pathname === "/inbox" || pathname === "/",
    },
    {
      label: "Contacts",
      href: "/contacts",
      icon: Users,
      badge: null,
      isActive: pathname.startsWith("/contacts"),
    },
    {
      label: "Broadcasts",
      href: "/broadcasts",
      icon: Radio,
      badge: null,
      isActive: pathname.startsWith("/broadcasts"),
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      badge: null,
      isActive: pathname.startsWith("/settings"),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-30 flex h-14 items-center justify-around border-t border-border/60 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden dark:bg-[#121b22]/95"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center py-1 transition-colors select-none",
              tab.isActive
                ? "text-[#00a884]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className={cn("h-5 w-5", tab.isActive && "stroke-[2.25px]")} />
              {tab.badge !== null && (
                <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25d366] px-1 text-[10px] font-bold text-white shadow-xs">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </div>
            <span
              className={cn(
                "mt-0.5 text-[10px]",
                tab.isActive ? "font-semibold text-[#00a884]" : "font-medium"
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  );
}
