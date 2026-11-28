"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import {
  CheckIcon,
  ClockIcon,
  HeartIcon,
  ImagePlusIcon,
  LogoutIcon,
  LockIcon,
  MailIcon,
  ShieldIcon,
  StarIcon,
  UserIcon,
} from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { blobToDataUrl, prepareAvatar, storageErrorMessage } from "@/lib/image";
import { MAX_USERNAME_LENGTH, validateUsername } from "@/lib/validation";
import {
  averageReviews,
  loadReviews,
  replyToReview,
  type Review,
  type ReviewAverages,
} from "@/lib/sales";
import { myStaffRole } from "@/lib/social";
import { loadResponseMinutes } from "@/lib/listings";
import {
  achievementFrames,
  emptyFrameStats,
  findFrame,
  frameProgress,
  isFrameUnlocked,
  ownedFrames,
  tagFrames,
  type FrameStats,
} from "@/lib/frames";
import { StaffBadge, VerifiedBadge } from "@/components/user-badge";
import { FrameRing } from "@/components/frame-ring";
import { InstallAppButton } from "@/components/pwa";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";


export default function ProfilePage() {
  const router = useRouter();
  const { user, refreshUser, signOut } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(user?.username ?? "");
  const [usernameState, setUsernameState] = useState<"idle" | "saving" | "ok">("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "ok">("idle");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [tags, setTags] = useState<string[]>([]);
  const [grantedFrames, setGrantedFrames] = useState<string[]>([]);
  const [frameStats, setFrameStats] = useState<FrameStats>(emptyFrameStats);
  const [frameCat, setFrameCat] = useState<"tag" | "achievement">("tag");
  const [role, setRole] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averages, setAverages] = useState<ReviewAverages | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [frameBusy, setFrameBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.username) setUsername(user.username);
  }, [user?.username]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;

    const load = async () => {
      const { data: tagRows } = await supabase
        .from("user_tags")
        .select("tag")
        .eq("user_id", user.id);
      if (!cancelled) setTags(((tagRows ?? []) as { tag: string }[]).map((row) => row.tag));

      const { data: frameRows } = await supabase
        .from("user_frames")
        .select("frame")
        .eq("user_id", user.id);
      if (!cancelled) {
        setGrantedFrames(((frameRows ?? []) as { frame: string }[]).map((row) => row.frame));
      }

      const staffRole = await myStaffRole(supabase);
      if (!cancelled) setRole(staffRole);

      const rows = await loadReviews(supabase, { sellerId: user.id }, 50);
      if (!cancelled) {
        setReviews(rows);
        setAverages(averageReviews(rows));
      }

      // Başarı çerçeveleri için istatistikler
      const [profileRes, listingRes, minutes] = await Promise.all([
        supabase
          .from("profiles")
          .select("rating, review_count, sales_count, created_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("listings")
          .select("id, status, view_count, favorite_count")
          .eq("seller_id", user.id),
        loadResponseMinutes(supabase, user.id),
      ]);

      if (cancelled) return;

      const profileRow = profileRes.data as
        | { rating: number | null; review_count: number | null; sales_count: number | null; created_at: string }
        | null;
      const listingRows = (listingRes.data ?? []) as unknown as {
        status: string | null;
        view_count: number | null;
        favorite_count: number | null;
      }[];

      setFrameStats({
        reviews: Number(profileRow?.review_count ?? rows.length ?? 0),
        rating: Number(profileRow?.rating ?? 0),
        sales: Number(profileRow?.sales_count ?? 0),
        responseMinutes: minutes,
        memberDays: profileRow?.created_at
          ? Math.floor((Date.now() - new Date(profileRow.created_at).getTime()) / 86400000)
          : 0,
        listings: listingRows.filter((row) => row.status === "active").length,
        views: listingRows.reduce((sum, row) => sum + Number(row.view_count ?? 0), 0),
        favorites: listingRows.reduce((sum, row) => sum + Number(row.favorite_count ?? 0), 0),
      });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    if (!supabase || !user) {
      setNotice("Önce giriş yapmalısın.");
      return;
    }

    setAvatarBusy(true);
    setNotice(null);

    try {
      // Küçült + JPEG'e çevir (büyük fotoğraf / HEIC sorunlarını çözer)
      const blob = await prepareAvatar(file, 512, 0.85);

      if (blob.size > 3 * 1024 * 1024) {
        throw new Error("Fotoğraf hâlâ çok büyük. Daha küçük bir görsel dene.");
      }

      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, {
          cacheControl: "3600",
          contentType: "image/jpeg",
          upsert: false,
        });

      let avatarUrl: string;
      let usedFallback = false;

      if (uploadError) {
        // Depo (bucket) kurulmamışsa fotoğrafı doğrudan profile yaz
        const fallbackable = /bucket not found|not found|security|policy|mime/i.test(
          uploadError.message,
        );
        if (!fallbackable) {
          throw new Error(storageErrorMessage(uploadError.message));
        }
        avatarUrl = await blobToDataUrl(blob);
        usedFallback = true;
      } else {
        avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

      if (updateError) {
        console.error("[profil]", updateError.message);
        throw new Error("Profil kaydedilemedi. Lütfen tekrar dene.");
      }

      await refreshUser();
      setNotice("Profil fotoğrafın güncellendi.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Fotoğraf yüklenemedi, tekrar dene.",
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  async function equipFrame(slug: string) {
    if (!supabase || !user) return;
    setFrameBusy(slug);
    let { error } = await supabase.rpc("set_frame", { p_frame: slug });

    if (error && /could not find the function|schema cache/i.test(error.message)) {
      const direct = await supabase
        .from("profiles")
        .update({ equipped_frame: slug })
        .eq("id", user.id);
      error = direct.error;
    }

    setFrameBusy(null);
    if (error) {
      setNotice("Çerçeve seçilemedi.");
      return;
    }
    await refreshUser();
  }

  async function sendReply(review: Review) {
    if (!supabase || !user) return;
    setReplyBusy(true);
    setReplyError(null);
    const result = await replyToReview(supabase, review.id, replyText);
    if (result.error) {
      setReplyBusy(false);
      setReplyError("Cevap gönderilemedi. Lütfen tekrar dene.");
      return;
    }
    const rows = await loadReviews(supabase, { sellerId: user.id }, 50);
    setReviews(rows);
    setAverages(averageReviews(rows));
    setReplyBusy(false);
    setReplyId(null);
    setReplyText("");
  }

  async function saveUsername() {
    setUsernameError(null);
    const validation = validateUsername(username);
    if (validation) {
      setUsernameError(validation);
      return;
    }
    if (!supabase || !user) return;

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

    const { error } = await supabase.from("profiles").update({ username: clean }).eq("id", user.id);
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
    if (!supabase) return;

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

  const owned = ownedFrames({ tags, staffTag: user.staffTag ?? role, frames: grantedFrames });
  const activeFrame = findFrame(user.frame);
  const staffTag = user.staffTag ?? role;

  return (
    <AppShell>
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Profil</h1>
      <p className="mt-1 text-xs text-muted-2 sm:text-sm">Hesap bilgilerin ve görünümün</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Link
          href="/favoriler"
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-white/4 text-[0.72rem] font-semibold text-[#ff9ba5] transition hover:text-text"
        >
          <HeartIcon width={14} height={14} /> Favoriler
        </Link>
        <Link
          href="/siparisler"
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-white/4 text-[0.72rem] font-semibold text-muted transition hover:text-text"
        >
          <CheckIcon width={14} height={14} /> Siparişler
        </Link>
        <Link
          href={`/satici?id=${user.id}`}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-white/4 text-[0.72rem] font-semibold text-muted transition hover:text-text"
        >
          <UserIcon width={14} height={14} /> Vitrinim
        </Link>
      </div>

      <div className="mt-2">
        <InstallAppButton />
      </div>

      {notice && (
        <div className="fixed bottom-24 left-1/2 z-[80] w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border border-line bg-surface/95 px-4 py-3 text-center text-xs leading-relaxed text-text shadow-2xl backdrop-blur">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-left">{notice}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="shrink-0 rounded-md px-1.5 text-muted-2 hover:text-text"
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Kendi profilini başkalarının gördüğü gibi aç */}
      <Link
        href={`/kullanici?id=${user.id}`}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white/4 text-sm font-semibold text-muted transition hover:border-accent/50 hover:text-text"
      >
        <UserIcon width={16} height={16} /> Profiliniz
      </Link>

      {/* Kimlik kartı */}
      <div className="mt-4 card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <FrameRing frame={activeFrame.slug} size={64} rounded="rounded-2xl">
              <span className="grid h-full w-full place-items-center overflow-hidden text-2xl font-extrabold text-text">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )}
              </span>
            </FrameRing>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
              className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-line bg-surface text-accent transition hover:border-accent"
              title="Profil fotoğrafını değiştir"
              aria-label="Profil fotoğrafını değiştir"
            >
              {avatarBusy ? <Spinner /> : <ImagePlusIcon width={13} height={13} />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void uploadAvatar(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>

          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-lg font-bold">
              <span className="truncate">{user.username}</span>
              {user.verifiedSeller && <VerifiedBadge small />}
              {staffTag && <StaffBadge tag={staffTag} small />}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-2">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[0.65rem]">
              <span className="badge border border-line bg-white/4 text-muted">
                {user.salesCount ?? 0} başarılı işlem
              </span>
              <span className="badge border border-line bg-white/4 text-muted">
                {user.rating && (user.reviewCount ?? 0) > 0
                  ? `${Number(user.rating).toFixed(1)} ★ (${user.reviewCount})`
                  : "puan yok"}
              </span>
              {tags.includes("vip") && (
                <span className="badge border border-accent/40 bg-accent/12 text-accent">VIP</span>
              )}
              {tags.includes("premium") && (
                <span className="badge border border-[#c084fc]/40 bg-[#c084fc]/12 text-[#d8b4fe]">
                  Premium
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Değerlendirmeler */}
      <section className="mt-4 card p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <StarIcon width={16} height={16} className="text-accent" /> Değerlendirmelerim
          </h2>
          <span className="text-[0.68rem] text-muted-2">
            {averages?.count ?? 0} değerlendirme
          </span>
        </div>

        {averages && averages.count > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Memnuniyet", averages.satisfaction],
              ["Güvenilirlik", averages.trust],
              ["İletişim", averages.communication],
              ["Teslimat", averages.delivery],
              ["Genel", averages.overall],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-line-soft bg-white/3 px-2.5 py-2">
                <p className="text-[0.62rem] text-muted-2">{label}</p>
                <p className="mt-0.5 text-sm font-bold text-accent">
                  {(value as number).toFixed(1)}
                  <span className="text-[0.6rem] font-normal text-muted-2"> /5</span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-2">
            Henüz değerlendirme yok. Satışların onaylandıkça alıcılar puan verir.
          </p>
        )}

        <div className="mt-3 space-y-2">
          {reviews.slice(0, 5).map((review) => (
            <div key={review.id} className="rounded-xl border border-line-soft bg-white/3 p-3">
              <div className="flex items-center gap-2">
                <span className="text-[0.75rem] font-semibold">
                  @{review.reviewer?.username ?? "alıcı"}
                </span>
                <span className="ml-auto inline-flex items-center gap-0.5 text-[0.7rem] text-accent">
                  <StarIcon width={11} height={11} /> {review.overall}/5
                </span>
              </div>
              {review.comment && (
                <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted">{review.comment}</p>
              )}

              {review.reply ? (
                <div className="mt-2 rounded-lg border-l-2 border-accent/60 bg-white/5 px-2.5 py-1.5">
                  <p className="text-[0.6rem] font-semibold text-accent">Yanıtın</p>
                  <p className="mt-0.5 whitespace-pre-line break-words text-[0.74rem] leading-relaxed text-muted">
                    {review.reply}
                  </p>
                </div>
              ) : replyId === review.id ? (
                <div className="mt-2">
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Değerlendirmeye cevap yaz…"
                    className="field resize-none text-[0.78rem] leading-relaxed"
                  />
                  {replyError && <p className="mt-1 text-[0.68rem] text-danger">{replyError}</p>}
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyId(null);
                        setReplyText("");
                        setReplyError(null);
                      }}
                      className="btn btn-ghost h-8 flex-1 text-[0.7rem]"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendReply(review)}
                      disabled={replyBusy || replyText.trim().length < 2}
                      className="btn btn-primary h-8 flex-1 text-[0.7rem]"
                    >
                      {replyBusy ? "…" : "Gönder"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setReplyId(review.id);
                    setReplyText("");
                    setReplyError(null);
                  }}
                  className="mt-1.5 text-[0.68rem] font-semibold text-accent"
                >
                  Cevapla
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

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
            {usernameState === "saving" ? (
              <Spinner />
            ) : usernameState === "ok" ? (
              <CheckIcon width={16} height={16} />
            ) : (
              "Kaydet"
            )}
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
          Beğendiğin çerçeveyi seç. Kilitli çerçeveler hedefine ulaşınca açılır.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setFrameCat("tag")}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border text-[0.72rem] font-semibold transition ${
              frameCat === "tag"
                ? "border-accent/50 bg-accent/12 text-accent"
                : "border-line bg-white/4 text-muted"
            }`}
          >
            <ShieldIcon width={13} height={13} /> Tag Çerçeveleri
          </button>
          <button
            type="button"
            onClick={() => setFrameCat("achievement")}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border text-[0.72rem] font-semibold transition ${
              frameCat === "achievement"
                ? "border-accent/50 bg-accent/12 text-accent"
                : "border-line bg-white/4 text-muted"
            }`}
          >
            <StarIcon width={13} height={13} /> Başarı Çerçeveleri
          </button>
        </div>

        {frameCat === "tag" ? (
          <>
            <p className="mt-2 text-[0.62rem] text-muted-2">
              Rozet ve yetkilere bağlı çerçeveler. En üstün olanlar VIP, Moderatör ve Kurucu.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {tagFrames.map((frame) => {
                const unlocked = owned.has(frame.needs) || frame.needs === "member";
                const isActive = (user.frame ?? "member") === frame.slug;
                return (
                  <button
                    key={frame.slug}
                    type="button"
                    disabled={frameBusy === frame.slug}
                    onClick={() => {
                      if (!unlocked) {
                        setNotice(`Bu çerçeve kilitli. ${frame.hint}.`);
                        return;
                      }
                      void equipFrame(frame.slug);
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition ${
                      isActive
                        ? "border-accent/60 bg-accent/10"
                        : unlocked
                          ? "border-line-soft bg-white/3 hover:border-line"
                          : "border-line-soft bg-white/2 opacity-45"
                    }`}
                    title={unlocked ? `${frame.name} çerçevesini seç` : frame.hint}
                  >
                    <FrameRing frame={frame.slug} size={40} rounded="rounded-full">
                      <span className="text-[0.7rem] font-bold text-text">
                        {frame.name.charAt(0)}
                      </span>
                    </FrameRing>
                    <span className="text-center text-[0.6rem] leading-tight text-muted">
                      {frame.name}
                    </span>
                    <span className="text-center text-[0.5rem] leading-tight text-muted-2">
                      {frame.hint}
                    </span>
                    {isActive && (
                      <span className="text-[0.55rem] font-semibold text-accent">aktif</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-[0.62rem] text-muted-2">
              Başarılarınla açılır. Kilitli olanlarda hedefine ne kadar kaldığı yazar.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {achievementFrames.map((frame) => {
                const earned = isFrameUnlocked(frame, frameStats);
                const gifted = grantedFrames.includes(frame.slug);
                const unlocked = earned || gifted;
                const isActive = (user.frame ?? "member") === frame.slug;
                const progress = unlocked ? null : frameProgress(frame, frameStats);
                return (
                  <button
                    key={frame.slug}
                    type="button"
                    disabled={frameBusy === frame.slug}
                    onClick={() => {
                      if (!unlocked) {
                        setNotice(`Bu çerçeve kilitli. ${frame.hint}.`);
                        return;
                      }
                      void equipFrame(frame.slug);
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition ${
                      isActive
                        ? "border-accent/60 bg-accent/10"
                        : unlocked
                          ? "border-line-soft bg-white/3 hover:border-line"
                          : "border-line-soft bg-white/2 opacity-60"
                    }`}
                    title={unlocked ? `${frame.name} çerçevesini seç` : frame.hint}
                  >
                    <FrameRing frame={frame.slug} size={40} rounded="rounded-full">
                      <span className="text-[0.7rem] font-bold text-text">
                        {frame.name.charAt(0)}
                      </span>
                    </FrameRing>
                    <span className="text-center text-[0.58rem] leading-tight text-muted">
                      {frame.name}
                    </span>
                    <span className="text-center text-[0.5rem] leading-tight text-muted-2">
                      {frame.hint}
                    </span>
                    {gifted && !earned && (
                      <span className="text-[0.5rem] font-semibold text-mint">hediye</span>
                    )}
                    {isActive && (
                      <span className="text-[0.55rem] font-semibold text-accent">aktif</span>
                    )}
                    {!unlocked && progress && (
                      <span className="text-center text-[0.5rem] leading-tight text-[#ffb057]">
                        {progress}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white/4 text-sm font-semibold text-text transition hover:border-accent/50 hover:text-accent"
      >
        <LogoutIcon width={16} height={16} /> Çıkış Yap
      </button>

      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/8 text-sm font-semibold text-[#ffb3bb] transition hover:bg-danger/15"
      >
        Hesabı sil
      </button>

      <DeleteAccountDialog
        open={deleteOpen}
        email={user.email}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          void signOut().then(() => router.replace("/"));
        }}
      />
    </AppShell>
  );
}
