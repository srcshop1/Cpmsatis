"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { LockIcon, UserIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { validateLogin } from "@/lib/validation";
import { TextField } from "./text-field";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const { signIn } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<{ identifier?: boolean; password?: boolean }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  const localErrors = validateLogin({ identifier, password });

  function errorFor(field: "identifier" | "password") {
    if (touched[field] || serverFieldErrors[field]) {
      return localErrors[field] ?? serverFieldErrors[field] ?? null;
    }
    return null;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ identifier: true, password: true });
    if (Object.keys(localErrors).length > 0) return;

    setPending(true);
    setServerError(null);
    setServerFieldErrors({});

    const result = await signIn({ identifier, password });
    setPending(false);

    if (!result.ok) {
      setServerError(result.message);
      setServerFieldErrors(result.fieldErrors ?? {});
      return;
    }

    router.replace(nextPath ?? "/panel");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {serverError && (
        <div
          role="alert"
          className="animate-pop rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-[#ffb3bb]"
        >
          {serverError}
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

      <button
        type="submit"
        className="btn btn-primary mt-2 h-12 w-full text-[0.98rem]"
        disabled={pending}
      >
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
