import { Users } from "lucide-react";

export type SidebarItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

export const mainItems: SidebarItem[] = [
  {
    label: "My Leads",
    href: "/leads",
    icon: Users,
  },
];
