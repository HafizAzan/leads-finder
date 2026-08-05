import React from "react";
import LeadHeader from "./lead-header";
import LeadSidebar from "./lead-sidebar";

type LeadLayoutProps = {
  children?: React.ReactNode;
};

function LeadLayout({ children }: LeadLayoutProps) {
  return (
    <div className="flex">
      <LeadSidebar />
      <div className="flex-1 flex-col">
        <LeadHeader />
        {children}
      </div>
    </div>
  );
}

export default React.memo(LeadLayout);
