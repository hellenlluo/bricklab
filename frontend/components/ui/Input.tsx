import * as React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={`text-xs bg-background border border-input rounded-none px-2 py-1 text-foreground outline-none focus:border-ring placeholder:text-muted-foreground${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
