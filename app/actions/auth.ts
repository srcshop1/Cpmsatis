"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DEMO_SESSION_COOKIE } from "@/lib/auth";
import {
  DemoAuthError,
  demoCreateUser,
  demoVerifyCredentials,
  signSession,
} from "@/lib/auth/demo-store";
import type { AuthState } from "@/lib/auth/types";
import { safeNextPath } from "@/lib/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { escapeLikePattern } from "@/lib/supabase/query";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
  validateLogin,
  validateRegister,
} from "@/lib/validation";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function setDemoSession(userId: string) {
  const token = await signSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = readString(formData, "username").trim();
  const email = readString(formData, "email").trim();
  const password = readString(formData, "password");
  const passwordConfirm = readString(formData, "passwordConfirm");
  const nextPath = safeNextPath(readString(formData, "next"));
  const successPath = nextPath ?? "/panel?hosgeldin=1";

  const values = { username, email };
  const errors = validateRegister({ username, email, password, passwordConfirm });

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "Lütfen işaretli alanları kontrol et.",
      errors,
      values,
    };
  }

  if (!isSupabaseConfigured) {
    try {
      const user = await demoCreateUser({ username, email, password });
      await setDemoSession(user.id);
    } catch (error) {
      if (error instanceof DemoAuthError) {
        const field = error.code === "EMAIL_TAKEN" ? "email" : "username";
        return {
          status: "error",
          message: error.message,
          errors: { [field]: error.message },
          values,
        };
      }
      return {
        status: "error",
        message: "Beklenmeyen bir hata oluştu, tekrar dene.",
        values,
      };
    }
    revalidatePath("/", "layout");
    redirect(successPath);
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", escapeLikePattern(username))
    .maybeSingle();

  if (lookupError) {
    return {
      status: "error",
      message: "Kullanıcı adı kontrol edilemedi. Supabase kurulumunu kontrol et.",
      values,
    };
  }
  if (existing) {
    return {
      status: "error",
      message: "Bu kullanıcı adı alınmış, başka bir tane dene.",
      errors: { username: "Bu kullanıcı adı alınmış." },
      values,
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: username,
      },
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    let userMessage = "Kayıt tamamlanamadı, tekrar dene.";
    const fieldErrors: Record<string, string> = {};

    if (message.includes("already registered") || message.includes("already been registered")) {
      userMessage = "Bu e-posta adresiyle zaten bir hesap var.";
      fieldErrors.email = userMessage;
    } else if (message.includes("password")) {
      userMessage = `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`;
      fieldErrors.password = userMessage;
    } else if (message.includes("email")) {
      userMessage = "E-posta adresini kontrol et.";
      fieldErrors.email = userMessage;
    }

    return { status: "error", message: userMessage, errors: fieldErrors, values };
  }

  // E-posta doğrulaması açıksa oturum gelmez; kullanıcıyı bilgilendir.
  if (!data.session) {
    return {
      status: "error",
      message:
        "Hesabın oluşturuldu. E-postana gelen doğrulama bağlantısına tıkladıktan sonra giriş yapabilirsin.",
      values,
    };
  }

  revalidatePath("/", "layout");
  redirect(successPath);
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = readString(formData, "identifier").trim();
  const password = readString(formData, "password");
  const nextPath = safeNextPath(readString(formData, "next"));
  const successPath = nextPath ?? "/panel";

  const values = { identifier };
  const errors = validateLogin({ identifier, password });

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "Lütfen işaretli alanları kontrol et.",
      errors,
      values,
    };
  }

  if (!isSupabaseConfigured) {
    try {
      const user = await demoVerifyCredentials(identifier, password);
      await setDemoSession(user.id);
    } catch (error) {
      const message =
        error instanceof DemoAuthError
          ? error.message
          : "Giriş yapılamadı, tekrar dene.";
      return { status: "error", message, values };
    }
    revalidatePath("/", "layout");
    redirect(successPath);
  }

  const supabase = await createSupabaseServerClient();

  let email = identifier;
  if (!identifier.includes("@")) {
    const { data: foundEmail, error: rpcError } = await supabase.rpc("email_for_username", {
      uname: normalizeUsername(identifier),
    });

    if (rpcError) {
      return {
        status: "error",
        message:
          "Kullanıcı adıyla giriş için Supabase'de email_for_username fonksiyonunu oluşturman gerekiyor (SUPABASE-KURULUM.md).",
        values,
      };
    }
    if (!foundEmail) {
      return {
        status: "error",
        message: "Bu kullanıcı adıyla bir hesap bulamadık.",
        errors: { identifier: "Kullanıcı bulunamadı." },
        values,
      };
    }
    email = String(foundEmail);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message = error.message.toLowerCase();
    const userMessage = message.includes("invalid login")
      ? "Kullanıcı adı/e-posta veya şifre hatalı."
      : message.includes("email not confirmed")
        ? "E-posta adresin henüz doğrulanmamış. Gelen kutunu kontrol et."
        : "Giriş yapılamadı, bilgilerini kontrol et.";
    return { status: "error", message: userMessage, values };
  }

  revalidatePath("/", "layout");
  redirect(successPath);
}

export async function logoutAction() {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } else {
    const cookieStore = await cookies();
    cookieStore.delete(DEMO_SESSION_COOKIE);
  }
  revalidatePath("/", "layout");
  redirect("/");
}
