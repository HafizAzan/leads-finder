import { Settings, Sparkles, Users } from "lucide-react";

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
  {
    label: "Generate Leads",
    href: "/leads/generate-leads",
    icon: Sparkles,
  },
  {
    label: "Settings",
    href: "/leads/settings",
    icon: Settings,
  },
];
