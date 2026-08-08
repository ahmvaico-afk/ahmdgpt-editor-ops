import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const INVOICE_UNLOCK_COOKIE = "ahmdgpt_invoice_unlock";
const UNLOCK_TTL_SECONDS = 60 * 60 * 4; // 4 hours

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  // Distinct signing context from the login session token, even though it
  // reuses the same underlying secret — the payload/purpose differs.
  return new TextEncoder().encode(`invoice:${secret}`);
}

/**
 * Used when INVOICE_PASSWORD isn't set on the host. Without a fallback the gate
 * rejected *every* password on the live deploy, because the hosting environment
 * was never given the variable — DEPLOY.md didn't list it. Setting
 * INVOICE_PASSWORD in the host's environment overrides this.
 */
const DEFAULT_INVOICE_PASSWORD = "ahmed123";

export async function checkInvoicePassword(password: string): Promise<boolean> {
  const expected = process.env.INVOICE_PASSWORD?.trim() || DEFAULT_INVOICE_PASSWORD;
  // Trimmed on both sides: phone keyboards and copy-paste routinely append a
  // space, and a silent "wrong password" over that is maddening.
  return password.trim() === expected;
}

export async function createInvoiceUnlockToken(): Promise<string> {
  return new SignJWT({ unlocked: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${UNLOCK_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyInvoiceUnlockToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

export const invoiceUnlockCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: UNLOCK_TTL_SECONDS,
};

export async function hasInvoiceUnlock(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(INVOICE_UNLOCK_COOKIE)?.value;
  if (!token) return false;
  return verifyInvoiceUnlockToken(token);
}
