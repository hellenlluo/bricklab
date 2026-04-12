import * as React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={`text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-800 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
