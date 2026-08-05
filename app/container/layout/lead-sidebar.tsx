import Logo from "@/app/components/common/logo";
import Button from "@/app/components/ui/button";
import { mainItems, SidebarItem } from "@/app/data/sidebar-data";
import Link from "next/link";
import React from "react";

type LeadSidebarItemsProps = {
  items: SidebarItem[];
};

function LeadSidebar() {
  return (
    <aside className="w-60 min-h-screen bg-sidebar shadow-md flex flex-col">
      <Logo />

      <div className="py-2 px-2">
        <LeadSidebarItems items={mainItems} />
      </div>

      <div className="mt-auto pb-5 px-2 w-full">
        <Button label="Logout" className="w-full" />
      </div>
    </aside>
  );
}

export default React.memo(LeadSidebar);

const LeadSidebarItems = ({ items }: LeadSidebarItemsProps) => {
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted transition-colors hover:bg-card hover:text-foreground"
          >
            <Icon className="w-4.5 h-4.5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
