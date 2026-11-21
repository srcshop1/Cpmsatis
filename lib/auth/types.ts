export type SessionUser = {
  id: string;
  username: string;
  email: string;
  createdAt?: string;
};

export type AuthState = {
  status: "idle" | "error";
  message?: string;
  errors?: Record<string, string>;
  values?: {
    username?: string;
    email?: string;
    identifier?: string;
  };
};

export const initialAuthState: AuthState = { status: "idle" };
