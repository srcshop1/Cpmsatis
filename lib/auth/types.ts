export type AppUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
  rating?: number | null;
  salesCount?: number | null;
  createdAt?: string;
};

export type AuthResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };
