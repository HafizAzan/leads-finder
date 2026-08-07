"use client";

import React from "react";
import Logo from "@/app/components/common/logo";
import Button from "@/app/components/ui/button";
import { mainItems, SidebarItem } from "@/app/data/sidebar-data";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

type LeadSidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

type LeadSidebarItemsProps = {
  items: SidebarItem[];
  onNavigate?: () => void;
};

function LeadSidebar({ open = false, onClose }: LeadSidebarProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[min(16.5rem,85vw)] flex-col border-r border-border bg-sidebar shadow-md transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-60 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-border lg:border-b-0">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            className="mr-3 mt-3 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-foreground lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <LeadSidebarItems items={mainItems} onNavigate={onClose} />
        </div>

        <div className="mt-auto w-full px-2 pb-5">
          <Button label="Logout" className="w-full" />
        </div>
      </aside>
    </>
  );
}

export default React.memo(LeadSidebar);

const LeadSidebarItems = ({ items, onNavigate }: LeadSidebarItemsProps) => {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={
              isActive(item.href)
                ? "flex items-center gap-3 px-3 py-2.5 text-sm text-foreground bg-card border-l-2 border-l-purple-500"
                : "flex items-center gap-3 px-3 py-2.5 text-sm text-muted transition-colors hover:bg-card hover:text-foreground"
            }
          >
            <Icon className="w-4.5 h-4.5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
