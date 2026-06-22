import * as React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={`text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-500 rounded-none px-2 py-1 text-zinc-800 dark:text-zinc-100 outline-none focus:border-accent dark:focus:border-accent placeholder:text-zinc-500 dark:placeholder:text-zinc-500${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
