import React from "react";
import Typography from "../ui/typography";

export function TableText({ text, className }: { text: string | React.ReactNode; className?: string }) {
  return <Typography variants="h6" className={`text-sm! ${className || ""}`} text={text} />;
}

export function TableParagraph({ text, className }: { text: string | React.ReactNode; className?: string }) {
  return <Typography variants="p" className={`text-sm! text-muted ${className || ""}`} text={text} />;
}

export function TableStatus({ text, className }: { text: string | React.ReactNode; className?: string }) {
  const statusClassVariants: Record<string, string> = {
    "✓ Approved": "bg-green-500/10 border border-green-500/20 text-green-400!",
    Approved: "bg-green-500/10 border border-green-500/20 text-green-400!",
    "⚠ Warning": "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20",
    Warning: "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20",
    Pending: "bg-pink-200/10 border border-pink-200/20 text-pink-200!",
    "Not Sent": "bg-pink-200/10 border border-pink-200/20 text-pink-200!",
    Generated: "bg-blue-400/10 text-blue-300! border border-blue-300/20",
    Ready: "bg-cyan-400/10 text-cyan-300! border border-cyan-300/20",
    Queued: "bg-purple-400/10 text-purple-300! border border-purple-300/20",
    Sending: "bg-orange-400/10 text-orange-300! border border-orange-300/20",
    Sent: "bg-green-500/10 border border-green-500/20 text-green-400!",
    Failed: "bg-red-500/10 border border-red-500/20 text-red-400!",
    Skipped: "bg-pink-200/10 border border-pink-200/20 text-pink-200!",
    Email: "bg-slate-500/10 border border-slate-500/20 text-slate-300!",
    Phone: "bg-slate-500/10 border border-slate-500/20 text-slate-300!",
    None: "bg-sidebar border border-border text-muted!",
  };

  const statusClass = statusClassVariants[text as string] || "bg-sidebar border border-border text-muted!";

  return (
    <Typography
      variants="p"
      className={`text-sm! rounded-full flex items-center justify-center w-fit h-fit px-3 py-0.5 ${statusClass} ${className || ""}`}
      text={text}
    />
  );
}
