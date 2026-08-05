import React from "react";
import Typography from "../ui/typography";

function logo() {
  return (
    <div className="py-4 px-4">
      <Typography text="AI Lead Finder" variants="h4" className="font-mono" />
      <Typography text="Find Leads. Grow Faster." variants="span" />
    </div>
  );
}

export default React.memo(logo);
