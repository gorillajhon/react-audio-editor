"use client";

import React, { forwardRef, ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ternary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  className?: string;
};

const base =
  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm " +
  "transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50";

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", className, children, type = "button", ...rest },
    ref
  ) => {
    let look = "";
    switch (variant) {
      case "primary":
        look =
          "bg-black text-white hover:opacity-90 " +
          "dark:bg-white dark:text-black";
        break;
      case "secondary":
        look =
          "bg-transparent text-white !border-1 !border-solid !border-white hover:bg-neutral-50 hover:text-gray " +
          "dark:border-neutral-700 dark:hover:bg-neutral-800";
        break;

      case "ternary":
        look =
          "border border-neutral-300 hover:bg-neutral-50 active:scale-[.99] dark:border-neutral-700 dark:hover:bg-neutral-800";
        break;
      default:
        break;
    }

    return (
      <button
        ref={ref}
        type={type}
        className={`${base} ${look} ${className ?? ""}`}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
