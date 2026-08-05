import React from "react";

type ButtonProps = {
  children?: React.ReactNode;
  label?: string;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

function Button({
  children,
  className = "",
  disabled = false,
  type = "button",
  label,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white border border-primary transition-all duration-200 hover:opacity-90 active:scale-[0.98]
        disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer
        ${className}
      `}
    >
      {label ?? children}
    </button>
  );
}

export default React.memo(Button);
