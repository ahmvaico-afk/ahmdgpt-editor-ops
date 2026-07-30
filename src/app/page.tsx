import Link from "next/link";
import { EyeLogo } from "@/components/eye-logo";
import { SystemLabel } from "@/components/ui/system-label";
import { EditorCodeForm } from "@/components/editor-code-form";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24">
      <div className="bg-accent-glow pointer-events-none absolute inset-x-0 bottom-0 h-[60vh]" />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-10 text-center">
        <div className="flex items-center gap-2.5 text-text">
          <EyeLogo className="h-8 w-8" />
          <span className="font-display text-lg font-extrabold tracking-tight">
            AHMD.GPT
          </span>
        </div>

        <div className="flex flex-col items-center gap-4">
          <SystemLabel>Editor Ops — Live</SystemLabel>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-text sm:text-5xl">
            Submit work.
            <br />
            Get paid.
          </h1>
          <p className="max-w-sm text-sm text-muted">
            Enter the editor code your admin gave you to track your submissions and
            earnings.
          </p>
        </div>

        <EditorCodeForm />

        <Link
          href="/admin"
          className="font-mono text-[11px] uppercase tracking-wider text-muted-2 transition-colors hover:text-muted"
        >
          Owner login →
        </Link>
      </div>
    </main>
  );
}
