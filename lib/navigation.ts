/** Sadece site içi yönlendirmelere izin verir (/panel?q=... gibi). */
export function safeNextPath(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith("/")) return undefined;
  if (value.startsWith("//")) return undefined;
  if (value.startsWith("/giris") || value.startsWith("/kayit")) return undefined;
  return value;
}
