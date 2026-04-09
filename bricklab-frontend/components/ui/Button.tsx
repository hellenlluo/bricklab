import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export default function Button({ className, children, ...props }: ButtonProps) {
  return (
    <button
      className={`px-2 py-1 rounded bg-zinc-700 text-white text-[10px] hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
