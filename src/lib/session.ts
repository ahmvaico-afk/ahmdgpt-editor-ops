import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ahmdgpt_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

/**
 * `admin` covers both the owner and QA. `adminRole` separates them: QA reviews
 * work — revisions, approvals, sign-off on logged time — but never sees money.
 * Older tokens issued before QA existed carry no adminRole, so anything reading
 * it must treat a missing value as "owner".
 */
export type AdminRole = "owner" | "qa";

export type SessionPayload =
  | { role: "editor"; editorId: string; editorCode: string; name: string }
  | {
      role: "admin";
      adminId: string;
      loginCode: string;
      name: string;
      adminRole?: AdminRole;
    };

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
