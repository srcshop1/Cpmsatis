"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  optionalNote?: string;
  showPasswordToggle?: boolean;
  passwordVisible?: boolean;
  onTogglePassword?: () => void;
};

export function TextField({
  label,
  icon,
  error,
  hint,
  optionalNote,
  showPasswordToggle,
  passwordVisible,
  onTogglePassword,
  id,
  className = "",
  ...inputProps
}: TextFieldProps) {
  const inputId = id ?? inputProps.name;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-muted">
          {label}
        </label>
        {optionalNote && <span className="text-[0.7rem] text-muted-2">{optionalNote}</span>}
      </div>

      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={`field ${icon ? "pl-11" : ""} ${
            showPasswordToggle ? "pr-11" : ""
          } ${error ? "border-danger/60" : ""} ${className}`}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...inputProps}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-2 transition hover:bg-white/5 hover:text-text"
            aria-label={passwordVisible ? "Şifreyi gizle" : "Şifreyi göster"}
            tabIndex={-1}
          >
            {passwordVisible ? <EyeOffIcon width={17} height={17} /> : <EyeIcon width={17} height={17} />}
          </button>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <div id={`${inputId}-hint`} className="mt-1.5 text-xs text-muted-2">
            {hint}
          </div>
        )
      )}
    </div>
  );
}
