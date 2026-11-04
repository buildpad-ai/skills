// buildpad-backend-file: supabase
/** Thin fetch wrapper for the role-rules API: never throws, always says what happened. */

export interface ApiReply<T> {
  ok: boolean;
  status: number;
  body: { data?: T; error?: string; issues?: { message: string }[]; currentVersion?: number } | null;
}

export async function call<T>(url: string, init?: RequestInit): Promise<ApiReply<T>> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
}

/** The most useful sentence a failed reply carries. */
export const failureMessage = (reply: ApiReply<unknown> | null, fallback: string): string =>
  reply?.body?.issues?.[0]?.message ?? reply?.body?.error ?? fallback;
