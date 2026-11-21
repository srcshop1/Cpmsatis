"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CheckIcon, LockIcon, MailIcon, UserIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import {
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateUsername,
} from "@/lib/validation";
import { TextField } from "./text-field";

type FieldName = "username" | "email" | "password" | "passwordConfirm";

export function RegisterForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const { signUp } = useAuth();

  const [values, setValues] = useState<Record<FieldName, string>>({
    username: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  const localErrors: Record<FieldName, string | null> = {
    username: validateUsername(values.username),
    email: validateEmail(values.email),
    password: validatePassword(values.password),
    passwordConfirm: validatePasswordConfirm(values.password, values.passwordConfirm),
  };

  function errorFor(field: FieldName) {
    if (touched[field] || serverFieldErrors[field]) {
      return localErrors[field] ?? serverFieldErrors[field] ?? null;
    }
    return null;
  }

  function update(field: FieldName, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ username: true, email: true, password: true, passwordConfirm: true });
    if (Object.values(localErrors).some(Boolean)) return;

    setPending(true);
    setServerError(null);
    setServerFieldErrors({});

    const result = await signUp({
      username: values.username,
      email: values.email,
      password: values.password,
    });
    setPending(false);

    if (!result.ok) {
      setServerError(result.message);
      setServerFieldErrors(result.fieldErrors ?? {});
      try {
        localStorage.setItem(
          "cpms_last_auth_error",
          JSON.stringify({ at: new Date().toISOString(), kind: "register", ...result }),
        );
      } catch {
        /* yoksay */
      }
      return;
    }

    router.replace(nextPath ?? "/panel?hosgeldin=1");
    router.refresh();
  }

  const passwordLongEnough = values.password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch =
    values.passwordConfirm.length > 0 && values.password === values.passwordConfirm;

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
        name="username"
        label="Kullanıcı Adı"
        placeholder="ör. oyuncu34"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={MAX_USERNAME_LENGTH}
        icon={<UserIcon width={17} height={17} />}
        value={values.username}
        onChange={(event) => update("username", event.target.value)}
        error={errorFor("username")}
        hint={`${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} karakter, harf/rakam kullanabilirsin.`}
      />

      <TextField
        name="email"
        type="email"
        label="E-Posta Adresi"
        placeholder="ornek@mail.com"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        icon={<MailIcon width={17} height={17} />}
        value={values.email}
        onChange={(event) => update("email", event.target.value)}
        error={errorFor("email")}
      />

      <TextField
        name="password"
        type={showPassword ? "text" : "password"}
        label="Şifre"
        placeholder="En az 6 karakter"
        autoComplete="new-password"
        icon={<LockIcon width={17} height={17} />}
        value={values.password}
        onChange={(event) => update("password", event.target.value)}
        error={errorFor("password")}
        showPasswordToggle
        passwordVisible={showPassword}
        onTogglePassword={() => setShowPassword((prev) => !prev)}
        hint={
          values.password.length > 0 ? (
            <span className={passwordLongEnough ? "text-mint" : "text-muted-2"}>
              {passwordLongEnough
                ? `Şifre uzunluğu uygun (${values.password.length} karakter).`
                : `En az ${MIN_PASSWORD_LENGTH} karakter olmalı (${values.password.length}/${MIN_PASSWORD_LENGTH}).`}
            </span>
          ) : (
            `En az ${MIN_PASSWORD_LENGTH} karakter.`
          )
        }
      />

      <TextField
        name="passwordConfirm"
        type={showPassword ? "text" : "password"}
        label="Şifrenizi Tekrar Yazın"
        placeholder="Şifreni bir kez daha gir"
        autoComplete="new-password"
        icon={<LockIcon width={17} height={17} />}
        value={values.passwordConfirm}
        onChange={(event) => update("passwordConfirm", event.target.value)}
        error={errorFor("passwordConfirm")}
        hint={
          passwordsMatch ? (
            <span className="inline-flex items-center gap-1 font-medium text-mint">
              <CheckIcon width={14} height={14} /> Şifreler eşleşiyor.
            </span>
          ) : undefined
        }
      />

      <button
        type="submit"
        className="btn btn-primary mt-2 h-12 w-full text-[0.98rem]"
        disabled={pending}
      >
        {pending ? (
          <>
            <Spinner /> Kayıt olunuyor…
          </>
        ) : (
          "Kayıt Ol"
        )}
      </button>

      <p className="pt-1 text-center text-xs leading-relaxed text-muted-2">
        Kayıt olarak <span className="text-muted">Kullanım Koşulları</span> ve{" "}
        <span className="text-muted">Gizlilik Politikası</span>&apos;nı kabul etmiş olursun.
      </p>

      <p className="text-center text-sm text-muted">
        Zaten hesabın var mı?{" "}
        <Link
          href={nextPath ? `/giris?next=${encodeURIComponent(nextPath)}` : "/giris"}
          className="font-semibold text-accent hover:text-accent-soft"
        >
          Giriş Yap
        </Link>
      </p>
    </form>
  );
}
