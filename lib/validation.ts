import { hasProfanity } from "@/lib/profanity";

export const MIN_PASSWORD_LENGTH = 6;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 20;

const USERNAME_RE = /^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ._-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Kullanıcı adı gerekli.";
  if (value.length < MIN_USERNAME_LENGTH)
    return `Kullanıcı adı en az ${MIN_USERNAME_LENGTH} karakter olmalı.`;
  if (value.length > MAX_USERNAME_LENGTH)
    return `Kullanıcı adı en fazla ${MAX_USERNAME_LENGTH} karakter olabilir.`;
  if (!USERNAME_RE.test(value))
    return "Sadece harf, rakam, nokta, tire ve alt çizgi kullanabilirsin.";
  if (hasProfanity(value)) return "Bu kullanıcı adı kullanılamaz.";
  return null;
}

export function validateEmail(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "E-posta adresi gerekli.";
  if (!EMAIL_RE.test(value)) return "Geçerli bir e-posta adresi yaz.";
  return null;
}

export function validatePassword(raw: string): string | null {
  if (!raw) return "Şifre gerekli.";
  if (raw.length < MIN_PASSWORD_LENGTH)
    return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`;
  return null;
}

export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (!confirm) return "Şifreni tekrar yazman gerekli.";
  if (password !== confirm) return "Şifreler birbiriyle uyuşmuyor.";
  return null;
}

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

export function validateRegister(input: RegisterInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const usernameError = validateUsername(input.username);
  if (usernameError) errors.username = usernameError;
  const emailError = validateEmail(input.email);
  if (emailError) errors.email = emailError;
  const passwordError = validatePassword(input.password);
  if (passwordError) errors.password = passwordError;
  const confirmError = validatePasswordConfirm(input.password, input.passwordConfirm);
  if (confirmError) errors.passwordConfirm = confirmError;
  return errors;
}

export type LoginInput = { identifier: string; password: string };

export function validateLogin(input: LoginInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.identifier.trim())
    errors.identifier = "Kullanıcı adı veya e-posta adresi gerekli.";
  if (!input.password) errors.password = "Şifre gerekli.";
  return errors;
}
