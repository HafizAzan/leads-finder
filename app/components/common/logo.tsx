import React from "react";
import Typography from "../ui/typography";

function logo() {
  return (
    <div className="min-w-0 px-4 py-4">
      <Typography text="AI Lead Finder" variants="h4" className="truncate font-mono text-lg! sm:text-xl!" />
      <Typography text="Find Leads. Grow Faster." variants="span" className="text-xs! text-muted sm:text-sm!" />
    </div>
  );
}

export default React.memo(logo);
