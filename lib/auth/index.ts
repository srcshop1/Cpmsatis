import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { escapeLikePattern } from "@/lib/supabase/query";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoFindById, demoFindByUsername, verifySession } from "./demo-store";
import type { SessionUser } from "./types";

export const DEMO_SESSION_COOKIE = "cpms_demo_session";

export const authMode: "supabase" | "demo" = isSupabaseConfigured ? "supabase" : "demo";

/**
 * Sunucu tarafında açık oturumu döndürür.
 * Supabase yapılandırılmışsa Supabase Auth, değilse yerel demo deposu kullanılır.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    let username =
      (user.user_metadata?.username as string | undefined) ??
      (user.user_metadata?.display_name as string | undefined) ??
      (user.email ? user.email.split("@")[0] : "kullanıcı");

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.username) username = profile.username;

    return {
      id: user.id,
      username,
      email: user.email ?? "",
      createdAt: user.created_at,
    };
  }

  const cookieStore = await cookies();
  const userId = await verifySession(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
  if (!userId) return null;

  const user = await demoFindById(userId);
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

/** Kullanıcı adının kullanımda olup olmadığını kontrol eder (sunucu tarafı). */
export async function isUsernameTaken(username: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", escapeLikePattern(username.trim()))
      .maybeSingle();
    return Boolean(data);
  }
  return Boolean(await demoFindByUsername(username));
}
