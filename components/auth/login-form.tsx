"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { LockIcon, UserIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { initialAuthState } from "@/lib/auth/types";
import { validateLogin } from "@/lib/validation";
import { TextField } from "./text-field";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialAuthState);

  const [identifier, setIdentifier] = useState(state.values?.identifier ?? "");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<{ identifier?: boolean; password?: boolean }>({});
  const [showPassword, setShowPassword] = useState(false);

  const localErrors = validateLogin({ identifier, password });

  function errorFor(field: "identifier" | "password") {
    if (touched[field]) return localErrors[field] ?? null;
    if (state.status === "error") return localErrors[field] ?? state.errors?.[field] ?? null;
    return null;
  }

  const showServerMessage = state.status === "error" && state.message;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {nextPath && <input type="hidden" name="next" value={nextPath} />}

      {showServerMessage && (
        <div
          role="alert"
          className="animate-pop rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-[#ffb3bb]"
        >
          {state.message}
        </div>
      )}

      <TextField
        name="identifier"
        label="Kullanıcı Adı veya E-Posta Adresi"
        placeholder="oyuncu34 veya ornek@mail.com"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        icon={<UserIcon width={17} height={17} />}
        value={identifier}
        onChange={(event) => {
          setIdentifier(event.target.value);
          setTouched((prev) => ({ ...prev, identifier: true }));
        }}
        error={errorFor("identifier")}
      />

      <TextField
        name="password"
        type={showPassword ? "text" : "password"}
        label="Şifre"
        placeholder="Şifreni gir"
        autoComplete="current-password"
        icon={<LockIcon width={17} height={17} />}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setTouched((prev) => ({ ...prev, password: true }));
        }}
        error={errorFor("password")}
        showPasswordToggle
        passwordVisible={showPassword}
        onTogglePassword={() => setShowPassword((prev) => !prev)}
      />

      <button type="submit" className="btn btn-primary mt-2 h-12 w-full text-[0.98rem]" disabled={pending}>
        {pending ? (
          <>
            <Spinner /> Giriş yapılıyor…
          </>
        ) : (
          "Giriş Yap"
        )}
      </button>

      <p className="pt-1 text-center text-sm text-muted">
        Hesabın yok mu?{" "}
        <Link
          href={nextPath ? `/kayit?next=${encodeURIComponent(nextPath)}` : "/kayit"}
          className="font-semibold text-accent hover:text-accent-soft"
        >
          Hemen kayıt ol
        </Link>
      </p>
    </form>
  );
}
