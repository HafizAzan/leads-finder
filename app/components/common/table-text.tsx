import React from "react";
import Typography from "../ui/typography";

export function TableText({ text, className }: { text: string | React.ReactNode; className?: string }) {
  return <Typography variants="h6" className={`text-sm! ${className || ""}`} text={text} />;
}

export function TableParagraph({ text, className }: { text: string | React.ReactNode; className?: string }) {
  return <Typography variants="p" className={`text-sm! text-border ${className || ""}`} text={text} />;
}

export function TableStatus({ text, className }: { text: string | React.ReactNode; className?: string }) {
  const statusClassVariants: Record<string, string> = {
    Positive: "bg-green-500/10 border border-green-500/20 text-green-400!",
    Approved: "bg-green-500/10 border border-green-500/20 text-green-400!",
    Sent: "bg-green-500/10 border border-green-500/20 text-green-400!",
    Negative: "bg-red-100 text-red-800 border border-red-200",
    Pending: "bg-pink-200/10 border border-pink-200/20 text-pink-200!",
    "Not Sent": "bg-pink-200/10 border border-pink-200/20 text-pink-200!",
    "Needs Fix": "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20",
    Queued: "bg-purple-400/10 text-purple-300! border border-purple-300/20",
    Rejected: "bg-purple-400/10 text-purple-300! border border-purple-300/20",
    Skipped: "bg-pink-200/10 border border-pink-200/20 text-pink-200!",
  };

  const statusClass = statusClassVariants[text as string] || "";

  return (
    <Typography
      variants="p"
      className={`text-sm! rounded-full flex items-center justify-center w-fit h-fit px-3 py-0.5 ${statusClass} ${className || ""}`}
      text={text}
    />
  );
}
