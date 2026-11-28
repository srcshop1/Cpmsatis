export type AppUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
  rating?: number | null;
  salesCount?: number | null;
  reviewCount?: number | null;
  verifiedSeller?: boolean | null;
  staffTag?: string | null;
  frame?: string | null;
  banned?: boolean | null;
  bannedUntil?: string | null;
  banReason?: string | null;
  bannedBy?: string | null;
  banAuthorUsername?: string | null;
  banAuthorRole?: string | null;
  bannedAt?: string | null;
  createdAt?: string;
};

export type AuthResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };
