"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import {
  CheckIcon,
  ClockIcon,
  ImagePlusIcon,
  LogoutIcon,
  LockIcon,
  MailIcon,
  UserIcon,
} from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { MAX_USERNAME_LENGTH, validateUsername } from "@/lib/validation";
import { useRouter } from "next/navigation";

const frames = [
  { name: "Kurucu", tone: "from-[#ff9a3c] to-[#f26a00]", locked: true },
  { name: "Moderatör", tone: "from-[#6c8cff] to-[#3b4fd8]", locked: true },
  { name: "VIP", tone: "from-[#ffd166] to-[#ff8a1f]", locked: true },
  { name: "Premium", tone: "from-[#c084fc] to-[#7c3aed]", locked: true },
  { name: "Onaylı Satıcı", tone: "from-[#35d49a] to-[#0f9d6e]", locked: true },
  { name: "Üye", tone: "from-[#3a4356] to-[#1b2130]", locked: false },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, refreshUser, signOut } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [username, setUsername] = useState(user?.username ?? "");
  const [usernameState, setUsernameState] = useState<"idle" | "saving" | "ok">("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "ok">("idle");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.username) setUsername(user.username);
  }, [user?.username]);

  async function saveUsername() {
    setUsernameError(null);
    const validation = validateUsername(username);
    if (validation) {
      setUsernameError(validation);
      return;
    }
    if (!supabase || !user) {
      setUsernameError("Supabase bağlantısı yok.");
      return;
    }

    setUsernameState("saving");
    const clean = username.trim();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", clean)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      setUsernameState("idle");
      setUsernameError("Bu kullanıcı adı alınmış.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: clean })
      .eq("id", user.id);

    if (error) {
      setUsernameState("idle");
      setUsernameError("Kullanıcı adı güncellenemedi.");
      return;
    }

    await supabase.auth.updateUser({ data: { username: clean, display_name: clean } });
    await refreshUser();
    setUsernameState("ok");
    setTimeout(() => setUsernameState("idle"), 2000);
  }

  async function savePassword() {
    setPasswordError(null);
    if (password.length < 6) {
      setPasswordError("Şifre en az 6 karakter olmalı.");
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordError("Şifreler birbiriyle uyuşmuyor.");
      return;
    }
    if (!supabase) {
      setPasswordError("Supabase bağlantısı yok.");
      return;
    }

    setPasswordState("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPasswordState("idle");
      setPasswordError("Şifre güncellenemedi, tekrar dene.");
      return;
    }
    setPassword("");
    setPasswordConfirm("");
    setPasswordState("ok");
    setTimeout(() => setPasswordState("idle"), 2500);
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  if (!user) return null;

  return (
    <AppShell>
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Profil</h1>
      <p className="mt-1 text-xs text-muted-2 sm:text-sm">Hesap bilgilerin ve görünümün</p>

      {/* Kimlik kartı */}
      <div className="mt-5 card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent-soft to-accent-deep text-2xl font-extrabold text-ink">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                user.username.charAt(0).toUpperCase()
              )}
            </span>
            <button
              type="button"
              disabled
              className="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-not-allowed place-items-center rounded-full border border-line bg-surface text-muted-2"
              title="Profil fotoğrafı yakında"
              aria-label="Profil fotoğrafı değiştir (yakında)"
            >
              <ImagePlusIcon width={13} height={13} />
            </button>
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{user.username}</p>
            <p className="mt-0.5 truncate text-xs text-muted-2">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[0.65rem]">
              <span className="badge border border-line bg-white/4 text-muted">
                {user.salesCount ?? 0} başarılı işlem
              </span>
              <span className="badge border border-line bg-white/4 text-muted">
                {user.rating ? `${Number(user.rating).toFixed(1)} ★` : "puan yok"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Kullanıcı adı */}
      <section className="mt-4 card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <UserIcon width={16} height={16} className="text-accent" /> Kullanıcı Adı
        </h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="field"
            value={username}
            maxLength={MAX_USERNAME_LENGTH}
            onChange={(event) => setUsername(event.target.value)}
            aria-label="Kullanıcı adı"
          />
          <button
            type="button"
            onClick={saveUsername}
            disabled={usernameState === "saving" || username === user.username}
            className="btn btn-primary h-11 shrink-0 px-4 text-sm disabled:opacity-50"
          >
            {usernameState === "saving" ? <Spinner /> : usernameState === "ok" ? <CheckIcon width={16} height={16} /> : "Kaydet"}
          </button>
        </div>
        {usernameError && <p className="mt-2 text-xs text-danger">{usernameError}</p>}
        <p className="mt-2 text-[0.68rem] text-muted-2">3–20 karakter, harf/rakam.</p>
      </section>

      {/* Şifre */}
      <section className="mt-4 card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <LockIcon width={16} height={16} className="text-accent" /> Şifre Değiştir
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            type="password"
            className="field"
            placeholder="Yeni şifre"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            aria-label="Yeni şifre"
          />
          <input
            type="password"
            className="field"
            placeholder="Yeni şifre (tekrar)"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            autoComplete="new-password"
            aria-label="Yeni şifre tekrar"
          />
        </div>
        {passwordError && <p className="mt-2 text-xs text-danger">{passwordError}</p>}
        {passwordState === "ok" && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-mint">
            <CheckIcon width={13} height={13} /> Şifren güncellendi.
          </p>
        )}
        <button
          type="button"
          onClick={savePassword}
          disabled={passwordState === "saving"}
          className="btn btn-ghost mt-3 h-10 px-4 text-sm"
        >
          {passwordState === "saving" ? <Spinner /> : "Şifreyi Güncelle"}
        </button>
      </section>

      {/* E-posta */}
      <section className="mt-4 card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <MailIcon width={16} height={16} className="text-accent" /> E-Posta
        </h2>
        <div className="mt-3 flex items-center gap-2">
          <input className="field" value={user.email} disabled />
          <span className="badge shrink-0 border border-line bg-white/5 text-[0.6rem] text-muted-2">
            <ClockIcon width={11} height={11} /> Yakında Gelecek
          </span>
        </div>
      </section>

      {/* Çerçeveler */}
      <section className="mt-4 card p-5">
        <h2 className="text-sm font-bold">Çerçeveler</h2>
        <p className="mt-1 text-[0.7rem] text-muted-2">
          Kurucu, moderatör, VIP, Premium ve Onaylı Satıcı çerçeveleri yetkili tarafından verilir.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {frames.map((frame) => (
            <div
              key={frame.name}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 ${
                frame.locked ? "border-line-soft bg-white/3" : "border-accent/40 bg-accent/10"
              }`}
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br ${frame.tone} text-sm font-extrabold text-ink ${
                  frame.locked ? "opacity-45" : ""
                }`}
              >
                {frame.name.charAt(0)}
              </span>
              <span className="text-center text-[0.6rem] leading-tight text-muted">
                {frame.name}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[0.65rem] text-muted-2">Çerçeve seçimi yakında aktif olacak.</p>
      </section>

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/8 text-sm font-semibold text-[#ffb3bb] transition hover:bg-danger/15"
      >
        <LogoutIcon width={16} height={16} /> Çıkış Yap
      </button>

      <p className="mt-6 text-center text-[0.68rem] text-muted-2">
        Hesap silme talebi için destek ekibine yazabilirsin.
      </p>
    </AppShell>
  );
}
