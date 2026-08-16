import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
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

/** Owner or QA. Use for anything both roles are allowed to do. */
export async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

/**
 * Owner only — money, rates, editor accounts, batch control.
 *
 * A token minted before QA existed has no adminRole; those belong to the owner,
 * so a missing value is treated as owner rather than locking them out.
 */
export async function requireOwnerSession() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  if (session.adminRole === "qa") return null;
  return session;
}

/**
 * A reviewer: either the owner, or an editor the owner promoted to QA.
 *
 * The QA flag is read from the database rather than the token, so revoking it
 * takes effect immediately instead of when their 14-day session expires.
 *
 * Returns `{ reviewerEditorId }` — null for the owner — so callers can stop a
 * QA editor from reviewing their own work.
 */
export async function requireReviewerSession(): Promise<
  { reviewerEditorId: string | null } | null
> {
  const session = await getSession();
  if (!session) return null;

  if (session.role === "admin") {
    return { reviewerEditorId: null };
  }

  const editor = await prisma.editor.findUnique({
    where: { id: session.editorId },
    select: { isQa: true, active: true },
  });
  if (!editor?.isQa || !editor.active) return null;
  return { reviewerEditorId: session.editorId };
}

/** Whether the signed-in editor currently wears the QA hat. */
export async function isQaEditor(): Promise<boolean> {
  const session = await getSession();
  if (session?.role !== "editor") return false;
  const editor = await prisma.editor.findUnique({
    where: { id: session.editorId },
    select: { isQa: true },
  });
  return Boolean(editor?.isQa);
}
