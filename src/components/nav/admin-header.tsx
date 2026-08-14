"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EyeLogo } from "@/components/eye-logo";
import { LogoutButton } from "@/components/nav/logout-button";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/totals", label: "Totals" },
  { href: "/admin/leaderboard", label: "Leaderboard" },
  { href: "/admin/styles", label: "Styles" },
  { href: "/admin/editors", label: "Editors" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/reel", label: "Reel" },
  { href: "/admin/covers", label: "Covers" },
];

export function AdminHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-3 px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:gap-8">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <EyeLogo className="h-6 w-6 text-text" />
            <span className="font-display text-sm font-extrabold tracking-tight text-text">
              AHMD.GPT
            </span>
          </Link>
          <nav className="flex items-center gap-5">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  pathname === link.href ? "text-accent" : "text-muted hover:text-text"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <LogoutButton redirectTo="/admin" />
      </div>
    </header>
  );
}
