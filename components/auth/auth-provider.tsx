"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { escapeLikePattern } from "@/lib/supabase/query";
import {
  demoRestoreSession,
  demoSignIn,
  demoSignOut,
  demoSignUp,
} from "@/lib/auth/local-demo";
import type { AppUser, AuthResult } from "@/lib/auth/types";

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  /** true: gerçek Supabase, false: tarayıcı içi demo */
  configured: boolean;
  signUp: (input: {
    username: string;
    email: string;
    password: string;
  }) => Promise<AuthResult>;
  signIn: (input: { identifier: string; password: string }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyError(message: string, status?: number): string {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "Kullanıcı adı/e-posta veya şifre hatalı.";
  if (value.includes("email not confirmed"))
    return "E-posta adresin henüz doğrulanmamış. Gelen kutunu kontrol et.";
  if (value.includes("already registered") || value.includes("already been registered"))
    return "Bu e-posta adresiyle zaten bir hesap var.";
  if (value.includes("password")) return "Şifre en az 6 karakter olmalı.";
  if (value.includes("rate limit") || status === 429)
    return "Çok fazla deneme yaptın. Biraz bekleyip tekrar dene.";
  if (value.includes("failed to fetch") || value.includes("networkerror"))
    return "Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.";
  if (value.includes("row-level security") || value.includes("permission"))
    return "Veritabanı izni hatası. SUPABASE-KURULUM.md içindeki SQL'i çalıştırdığından emin ol.";
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const buildUser = useCallback(
    async (authUser: SupabaseUser): Promise<AppUser> => {
      const fallback: AppUser = {
        id: authUser.id,
        username:
          (authUser.user_metadata?.username as string | undefined) ??
          (authUser.user_metadata?.display_name as string | undefined) ??
          (authUser.email ? authUser.email.split("@")[0] : "kullanici"),
        email: authUser.email ?? "",
        createdAt: authUser.created_at,
      };

      if (!supabase) return fallback;

      let { data, error } = await supabase
        .from("profiles")
        .select(
          "username, avatar_url, rating, sales_count, review_count, verified_seller, equipped_frame",
        )
        .eq("id", authUser.id)
        .maybeSingle();

      // Şema henüz güncellenmediyse temel kolonlarla devam et
      if (error) {
        const retry = await supabase
          .from("profiles")
          .select("username, avatar_url, rating, sales_count")
          .eq("id", authUser.id)
          .maybeSingle();
        data = retry.data as typeof data;
        error = retry.error;
      }

      if (error || !data) return fallback;

      void supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", authUser.id)
        .then(() => undefined);

      return {
        id: authUser.id,
        username: data.username ?? fallback.username,
        email: fallback.email,
        avatarUrl: data.avatar_url,
        rating: data.rating,
        salesCount: data.sales_count,
        reviewCount: data.review_count,
        verifiedSeller: data.verified_seller,
        frame: data.equipped_frame,
        createdAt: authUser.created_at,
      };
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    const init = async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        if (data.session?.user) {
          setUser(await buildUser(data.session.user));
        } else {
          setUser(null);
        }

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return;
          if (session?.user) {
            void buildUser(session.user).then((nextUser) => {
              if (!cancelled) setUser(nextUser);
            });
          } else {
            setUser(null);
          }
        });
        unsubscribe = () => listener.subscription.unsubscribe();
        if (!cancelled) setLoading(false);
      } else {
        const restored = demoRestoreSession();
        if (!cancelled) {
          setUser(restored);
          setLoading(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [supabase, buildUser]);

  const signUp = useCallback<AuthContextValue["signUp"]>(
    async ({ username, email, password }) => {
      const cleanUsername = username.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (!supabase) {
        const result = await demoSignUp({ username: cleanUsername, email: cleanEmail, password });
        if (!result.ok) return result;
        setUser(result.user);
        return { ok: true };
      }

      const { data: existing, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", escapeLikePattern(cleanUsername))
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        // Tablo henüz kurulmamışsa kayıt yine denenebilir; profil trigger'ı
        // çalışmıyorsa kullanıcı adı metadata'dan okunur.
        console.warn("Kullanıcı adı kontrolü başarısız:", checkError.message);
      }

      if (existing) {
        const message = "Bu kullanıcı adı alınmış, başka bir tane dene.";
        return { ok: false, message, fieldErrors: { username: message } };
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { username: cleanUsername, display_name: cleanUsername } },
      });

      if (error) {
        const message = friendlyError(error.message, error.status);
        const fieldErrors: Record<string, string> = {};
        if (message.includes("e-posta")) fieldErrors.email = message;
        if (message.includes("Şifre")) fieldErrors.password = message;
        return { ok: false, message, fieldErrors };
      }

      if (!data.session) {
        return {
          ok: false,
          message:
            "Hesabın oluşturuldu. E-postana gelen doğrulama bağlantısına tıkladıktan sonra giriş yapabilirsin.",
        };
      }

      if (data.user) setUser(await buildUser(data.user));
      return { ok: true };
    },
    [supabase, buildUser],
  );

  const signIn = useCallback<AuthContextValue["signIn"]>(
    async ({ identifier, password }) => {
      const cleanIdentifier = identifier.trim();

      if (!supabase) {
        const result = await demoSignIn(cleanIdentifier, password);
        if (!result.ok) return result;
        setUser(result.user);
        return { ok: true };
      }

      let email = cleanIdentifier;
      if (!cleanIdentifier.includes("@")) {
        const { data, error } = await supabase.rpc("email_for_username", {
          uname: cleanIdentifier.toLowerCase(),
        });

        if (error) {
          return {
            ok: false,
            message:
              "Kullanıcı adıyla giriş şu an çalışmıyor. Supabase'de schema.sql çalıştırıldı mı? E-posta ile giriş yapabilirsin.",
          };
        }
        if (!data) {
          return {
            ok: false,
            message: "Bu kullanıcı adıyla bir hesap bulamadık.",
            fieldErrors: { identifier: "Kullanıcı bulunamadı." },
          };
        }
        email = String(data);
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (error) {
        return { ok: false, message: friendlyError(error.message, error.status) };
      }

      if (data.user) setUser(await buildUser(data.user));
      return { ok: true };
    },
    [supabase, buildUser],
  );

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      demoSignOut();
    }
    setUser(null);
  }, [supabase]);

  const refreshUser = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (data.user) setUser(await buildUser(data.user));
  }, [supabase, buildUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: isSupabaseConfigured,
      signUp,
      signIn,
      signOut,
      refreshUser,
    }),
    [user, loading, signUp, signIn, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth, AuthProvider içinde kullanılmalı.");
  }
  return context;
}
