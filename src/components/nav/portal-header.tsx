import Link from "next/link";
import { EyeLogo } from "@/components/eye-logo";
import { LogoutButton } from "@/components/nav/logout-button";

export function PortalHeader({ editorCode }: { editorCode: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <Link href={`/portal/${editorCode}/dashboard`} className="flex items-center gap-2">
          <EyeLogo className="h-6 w-6 text-text" />
          <span className="font-display text-sm font-extrabold tracking-tight text-text">
            AHMD.GPT
          </span>
        </Link>
        <LogoutButton redirectTo={`/portal/${editorCode}`} />
      </div>
    </header>
  );
}
