import { cookies } from "next/headers";
import { SESSION_COOKIE, SessionPayload, verifySessionToken } from "@/lib/session";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireEditorSession() {
  const session = await getSession();
  if (!session || session.role !== "editor") return null;
  return session;
}

export async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}
