"use client";

/**
 * Supabase anahtarları yoksa kullanılan tarayıcı içi demo hesap deposu.
 * Sadece geliştirme/demo içindir; gerçek güvenlik sağlamaz.
 */

export type LocalUser = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
};

type StoredUser = LocalUser & { passwordHash: string; salt: string };

const USERS_KEY = "cpms_demo_users_v1";
const SESSION_KEY = "cpms_demo_session_v1";

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function publicUser(user: StoredUser): LocalUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export type DemoResult =
  | { ok: true; user: LocalUser }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export async function demoSignUp(input: {
  username: string;
  email: string;
  password: string;
}): Promise<DemoResult> {
  const users = readUsers();
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  const normalized = username.toLowerCase();

  if (users.some((user) => user.email.toLowerCase() === email)) {
    const message = "Bu e-posta adresiyle zaten bir hesap var.";
    return { ok: false, message, fieldErrors: { email: message } };
  }
  if (users.some((user) => user.username.toLowerCase() === normalized)) {
    const message = "Bu kullanıcı adı alınmış, başka bir tane dene.";
    return { ok: false, message, fieldErrors: { username: message } };
  }

  const salt = crypto.randomUUID();
  const user: StoredUser = {
    id: crypto.randomUUID(),
    username,
    email,
    passwordHash: await hashPassword(input.password, salt),
    salt,
    createdAt: new Date().toISOString(),
  };

  writeUsers([...users, user]);
  localStorage.setItem(SESSION_KEY, user.id);
  return { ok: true, user: publicUser(user) };
}

export async function demoSignIn(identifier: string, password: string): Promise<DemoResult> {
  const value = identifier.trim().toLowerCase();
  const user = readUsers().find(
    (candidate) =>
      candidate.email.toLowerCase() === value || candidate.username.toLowerCase() === value,
  );

  if (!user) {
    return { ok: false, message: "Bu bilgilerle bir hesap bulamadık." };
  }

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    return { ok: false, message: "Şifre hatalı, tekrar dene." };
  }

  localStorage.setItem(SESSION_KEY, user.id);
  return { ok: true, user: publicUser(user) };
}

export function demoRestoreSession(): LocalUser | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const user = readUsers().find((candidate) => candidate.id === id);
    return user ? publicUser(user) : null;
  } catch {
    return null;
  }
}

export function demoSignOut() {
  localStorage.removeItem(SESSION_KEY);
}
