import LeadLayout from "@/app/container/layout/lead-layout";
import React from "react";

export default function LeadRouteLayout({ children }: { children: React.ReactNode }) {
  return <LeadLayout>{children}</LeadLayout>;
}
