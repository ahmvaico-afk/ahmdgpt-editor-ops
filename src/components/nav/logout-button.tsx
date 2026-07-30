"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-accent"
    >
      Log out
    </button>
  );
}
