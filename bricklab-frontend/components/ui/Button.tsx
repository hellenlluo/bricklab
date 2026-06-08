import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export default function Button({ className, children, ...props }: ButtonProps) {
  return (
    <button
      className={`h-7 flex items-center justify-center px-2 rounded-none bg-accent text-white text-[10px] hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
