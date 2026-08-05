import React from "react";
import Typography from "../ui/typography";

type StatusAction = "success" | "failed";

type StatusProps = {
  type: StatusAction;
};

const statusConfig = {
  success: {
    label: "System Working",
    wrapper: "bg-green-500/10 border border-green-500/20",
    dot: "bg-green-500",
    text: "text-green-400",
  },

  failed: {
    label: "System Failed",
    wrapper: "bg-red-500/10 border border-red-500/20",
    dot: "bg-red-500",
    text: "text-red-400",
  },
} satisfies Record<
  StatusAction,
  {
    label: string;
    wrapper: string;
    dot: string;
    text: string;
  }
>;

function Status({ type }: StatusProps) {
  const status = statusConfig[type];

  return (
    <div
      className={`px-3 py-1.5 rounded-full flex items-center gap-x-2 ${status.wrapper}`}
    >
      <div
        className={`w-2 h-2 rounded-full ${status.dot} ${
          type === "success" ? "animate-pulse" : ""
        }`}
      />

      <Typography
        text={status.label}
        variants="span"
        className={`font-medium text-[11px]! uppercase tracking-wide ${status.text}`}
      />
    </div>
  );
}

export default React.memo(Status);
