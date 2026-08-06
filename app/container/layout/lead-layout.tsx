import React from "react";
import LeadHeader from "./lead-header";
import LeadSidebar from "./lead-sidebar";

type LeadLayoutProps = {
  children?: React.ReactNode;
};

function LeadLayout({ children }: LeadLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <LeadSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <LeadHeader />

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export default React.memo(LeadLayout);
