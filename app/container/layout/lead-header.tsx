import React from "react";
import Typography from "@/app/components/ui/typography";
import Status from "@/app/components/common/status";

function LeadHeader() {
  return (
    <header className="py-6 px-6 bg-header shadow-md border-b border-border">
      <div className="flex items-center justify-between">
        <Typography className="" text="List" variants="h2" />
        <Status type="success" />
      </div>
    </header>
  );
}

export default React.memo(LeadHeader);
