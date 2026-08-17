import { request, setToken } from "@/lib/api";

export async function exchangeFirebaseToken(idToken: string, profile?: { displayName?: string | null; photoURL?: string | null }) {
  const result = await request<{ ok: boolean; token: string; user: { id: string; email: string; fullName: string; avatarUrl: string; githubUsername: string; emailConfirmedAt: string | null } }>(
    "/auth/firebase/session",
    {
      method: "POST",
      body: JSON.stringify({
        idToken,
        displayName: profile?.displayName || undefined,
        photoURL: profile?.photoURL || undefined,
      }),
    }
  );
  setToken(result.token);
  return result;
}
