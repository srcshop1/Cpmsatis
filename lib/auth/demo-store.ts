import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeUsername } from "@/lib/validation";

/**
 * Supabase anahtarları girilmediğinde kullanılan yerel demo deposu.
 * Veriler .data/ klasöründe tutulur (git'e girmez) ve sadece geliştirme içindir.
 */

export type DemoUser = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "demo-users.json");
const SECRET_FILE = path.join(DATA_DIR, "demo-secret");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readUsers(): Promise<DemoUser[]> {
  try {
    const raw = await readFile(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DemoUser[]) : [];
  } catch {
    return [];
  }
}

async function writeUsers(users: DemoUser[]) {
  await ensureDataDir();
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export class DemoAuthError extends Error {
  code: "EMAIL_TAKEN" | "USERNAME_TAKEN" | "INVALID_CREDENTIALS" | "USER_NOT_FOUND";
  constructor(code: DemoAuthError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export async function demoFindByEmail(email: string) {
  const users = await readUsers();
  const target = email.trim().toLowerCase();
  return users.find((user) => user.email.toLowerCase() === target) ?? null;
}

export async function demoFindByUsername(username: string) {
  const users = await readUsers();
  const target = normalizeUsername(username);
  return users.find((user) => user.username.toLowerCase() === target) ?? null;
}

export async function demoCreateUser(input: {
  username: string;
  email: string;
  password: string;
}): Promise<DemoUser> {
  const users = await readUsers();
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  const normalized = normalizeUsername(username);

  if (users.some((user) => user.email.toLowerCase() === email)) {
    throw new DemoAuthError("EMAIL_TAKEN", "Bu e-posta adresiyle zaten bir hesap var.");
  }
  if (users.some((user) => user.username.toLowerCase() === normalized)) {
    throw new DemoAuthError("USERNAME_TAKEN", "Bu kullanıcı adı alınmış, başka bir tane dene.");
  }

  const user: DemoUser = {
    id: `demo_${randomBytes(8).toString("hex")}`,
    username,
    email,
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeUsers(users);
  return user;
}

export async function demoVerifyCredentials(identifier: string, password: string) {
  const value = identifier.trim();
  const user = value.includes("@")
    ? await demoFindByEmail(value)
    : await demoFindByUsername(value);

  if (!user) {
    throw new DemoAuthError("USER_NOT_FOUND", "Bu bilgilerle bir hesap bulamadık.");
  }
  if (!verifyPassword(password, user.passwordHash)) {
    throw new DemoAuthError("INVALID_CREDENTIALS", "Şifre hatalı, tekrar dene.");
  }
  return user;
}

/* ----------------------------- Oturum imzası ----------------------------- */

async function getSecret() {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    return process.env.AUTH_SECRET;
  }
  try {
    const stored = (await readFile(SECRET_FILE, "utf8")).trim();
    if (stored.length >= 16) return stored;
  } catch {
    /* dosya yok */
  }
  await ensureDataDir();
  const secret = randomBytes(32).toString("hex");
  await writeFile(SECRET_FILE, secret, "utf8");
  return secret;
}

export async function signSession(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }),
  ).toString("base64url");
  const secret = await getSecret();
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function verifySession(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const secret = await getSecret();
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return typeof data.uid === "string" ? data.uid : null;
  } catch {
    return null;
  }
}

export async function demoFindById(id: string) {
  const users = await readUsers();
  return users.find((user) => user.id === id) ?? null;
}
